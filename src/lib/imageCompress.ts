/**
 * Client-side image resize and compression utility.
 * Caps the longest edge to maxSide (default 1280px) and outputs image/jpeg at quality (default 0.8).
 */
export async function resizeAndCompressImage(
  source: File | Blob | string,
  maxSide = 1280,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let srcUrl = "";
    const isBlob = typeof source !== "string";
    if (isBlob) {
      srcUrl = URL.createObjectURL(source);
    } else {
      srcUrl = source;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          if (isBlob) URL.revokeObjectURL(srcUrl);
          reject(new Error("Image has invalid dimensions"));
          return;
        }

        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          if (isBlob) URL.revokeObjectURL(srcUrl);
          reject(new Error("Could not get 2D canvas context"));
          return;
        }

        // Fill white background in case input is transparent PNG/WebP
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (isBlob) URL.revokeObjectURL(srcUrl);
        resolve(dataUrl);
      } catch (err) {
        if (isBlob) URL.revokeObjectURL(srcUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      if (isBlob) URL.revokeObjectURL(srcUrl);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = srcUrl;
  });
}
