import { NextResponse } from 'next/server';
import {
  createSessionToken,
  getLanUrls,
  getSessionUser,
  hashPassword,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { getStorageMode, readDb } from '@/lib/db';
import { SessionUser } from '@/lib/types';

export async function GET() {
  const session = await getSessionUser();
  const storageMode = getStorageMode();

  if (!session) {
    return NextResponse.json({
      user: null,
      lanUrls: getLanUrls(3000),
      storageMode,
    });
  }

  const db = await readDb();
  const dbUser = db.users.find((u) => u.id === session.id && u.active);
  if (!dbUser) {
    const res = NextResponse.json({
      user: null,
      lanUrls: getLanUrls(3000),
      storageMode,
    });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  const currentUser: SessionUser = {
    id: dbUser.id,
    username: dbUser.username,
    fullName: dbUser.fullName,
    role: dbUser.role,
  };

  return NextResponse.json({
    user: currentUser,
    lanUrls: getLanUrls(3000),
    storageMode,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (action === 'logout') {
      const res = NextResponse.json({ ok: true });
      res.cookies.delete(SESSION_COOKIE_NAME);
      return res;
    }

    if (action === 'login') {
      const cleanUser = String(username || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!cleanUser || !cleanPass) {
        return NextResponse.json(
          { error: 'Ingresa tu usuario y contraseña.' },
          { status: 400 }
        );
      }

      const db = await readDb();
      const found = db.users.find(
        (u) => u.username.toLowerCase() === cleanUser && u.active
      );

      if (!found || found.passwordHash !== hashPassword(cleanPass)) {
        return NextResponse.json(
          { error: 'Usuario o contraseña incorrectos.' },
          { status: 401 }
        );
      }

      const sessionUser: SessionUser = {
        id: found.id,
        username: found.username,
        fullName: found.fullName,
        role: found.role,
      };

      const token = createSessionToken(sessionUser);
      const res = NextResponse.json({
        ok: true,
        user: sessionUser,
        lanUrls: getLanUrls(3000),
        storageMode: getStorageMode(),
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return res;
    }

    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: 'Error procesando autenticación.' },
      { status: 500 }
    );
  }
}
