/**
 * Renders text with a typewriter effect — characters appear one by one.
 */
export class TextRenderer {
  static animate(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: {
      duration: number;
      font: string;
      fontSize: number;
      color: string;
    },
  ): Promise<void> {
    const { duration, font, fontSize, color } = options;
    const charCount = text.length;

    if (charCount === 0 || duration <= 0) {
      TextRenderer.drawText(ctx, text, x, y, font, fontSize, color);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const visibleChars = Math.ceil(progress * charCount);
        const partial = text.slice(0, visibleChars);

        TextRenderer.drawText(ctx, partial, x, y, font, fontSize, color);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
  }

  /** Draw finalized text onto a context with a background for readability. */
  static drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    fontSize: number,
    color: string,
  ): void {
    ctx.save();
    ctx.font = `${fontSize}px ${font}`;
    ctx.textBaseline = 'top';

    // Draw semi-transparent background behind text
    const metrics = ctx.measureText(text);
    const padding = fontSize * 0.2;
    const bgX = x - padding;
    const bgY = y - padding;
    const bgW = metrics.width + padding * 2;
    const bgH = fontSize * 1.3 + padding * 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(bgX, bgY, bgW, bgH);

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
