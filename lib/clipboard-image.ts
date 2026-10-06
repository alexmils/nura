/** First image File from a paste/clipboard event, if any. */
export function imageFileFromClipboard(
  data: DataTransfer | null | undefined
): File | null {
  if (!data) return null;
  const items = data.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  const files = data.files;
  if (files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file?.type.startsWith("image/")) return file;
    }
  }
  return null;
}
