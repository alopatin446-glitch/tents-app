import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { uploadFileToS3 } from '@/lib/storage/s3';

export const runtime = 'nodejs';

const ALLOWED_MIME_PREFIXES = ['image/', 'video/'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function getString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function assertClientAccess(clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId,
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  return client;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    if (!organizationId) {
      return jsonError('У пользователя не найдена организация.', 403);
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId')?.trim();

    if (!clientId) {
      return jsonError('Не передан clientId.', 400);
    }

    const client = await assertClientAccess(clientId, organizationId);

    if (!client) {
      return jsonError('Заказ не найден или недоступен.', 404);
    }

    const files = await prisma.clientFile.findMany({
      where: {
        clientId,
        organizationId,
        deletedAt: null,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json({ ok: true, files });
  } catch (error) {
    console.error('[client-files GET]', error);
    return jsonError('Не удалось получить файлы заказа.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    if (!organizationId) {
      return jsonError('У пользователя не найдена организация.', 403);
    }

    const formData = await request.formData();

    const clientId = getString(formData.get('clientId'));
    const category = getString(formData.get('category')) || 'other';
    const fileValue = formData.get('file');

    if (!clientId) {
      return jsonError('Не передан clientId.', 400);
    }

    if (!(fileValue instanceof File)) {
      return jsonError('Файл не передан.', 400);
    }

    const isAllowedFile =
      ALLOWED_MIME_PREFIXES.some((prefix) => fileValue.type.startsWith(prefix)) ||
      ALLOWED_MIME_TYPES.includes(fileValue.type);

    if (!isAllowedFile) {
      return jsonError('Разрешены фото, видео, PDF, Word и Excel.', 400);
    }

    const client = await assertClientAccess(clientId, organizationId);

    if (!client) {
      return jsonError('Заказ не найден или недоступен.', 404);
    }

    const lastFile = await prisma.clientFile.findFirst({
      where: {
        clientId,
        organizationId,
      },
      orderBy: {
        sortOrder: 'desc',
      },
      select: {
        sortOrder: true,
      },
    });

    const nextSortOrder = (lastFile?.sortOrder ?? -1) + 1;

    const uploaded = await uploadFileToS3(fileValue, organizationId);

    const createdFile = await prisma.clientFile.create({
      data: {
        clientId,
        organizationId,
        url: uploaded.url,
        key: uploaded.key,
        fileName: fileValue.name,
        mimeType: fileValue.type || 'application/octet-stream',
        size: fileValue.size,
        category,
        sortOrder: nextSortOrder,
      },
    });

    return NextResponse.json({ ok: true, file: createdFile });
  } catch (error) {
    console.error('[client-files POST]', error);
    return jsonError('Не удалось загрузить файл заказа.', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    if (!organizationId) {
      return jsonError('У пользователя не найдена организация.', 403);
    }

    const body = await request.json().catch(() => null);
    const fileId = typeof body?.fileId === 'string' ? body.fileId.trim() : '';

    if (!fileId) {
      return jsonError('Не передан fileId.', 400);
    }

    const existingFile = await prisma.clientFile.findFirst({
      where: {
        id: fileId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existingFile) {
      return jsonError('Файл не найден или уже удалён.', 404);
    }

    await prisma.clientFile.update({
      where: {
        id: fileId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[client-files DELETE]', error);
    return jsonError('Не удалось удалить файл заказа.', 500);
  }
}