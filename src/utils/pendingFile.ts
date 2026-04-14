let pending: File | null = null;

export function setPendingFile(file: File) {
  pending = file;
}

export function consumePendingFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}
