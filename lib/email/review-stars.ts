/**
 * The five-row star block from the review email.
 *
 * Pure and dependency-free so the same function can render the delivered mail
 * and the admin preview. Every star points at the feedback form — the rows are
 * a visual rating prompt, not a real vote. The form itself stays the single
 * place where a score and a note are recorded, so there is no second review
 * page to maintain.
 */

const GREEN = "#00B67A";
const LIME = "#73CF11";
const YELLOW = "#FFCE00";
const ORANGE = "#FF8629";
const RED = "#FF3722";
const GREY = "#DCDCE6";

const ROWS = [
  { stars: 5, colour: GREEN },
  { stars: 4, colour: LIME },
  { stars: 3, colour: YELLOW },
  { stars: 2, colour: ORANGE },
  { stars: 1, colour: RED },
] as const;

function cell(filled: boolean, colour: string, href: string): string {
  return (
    `<td align="center" valign="middle" style="background-color:${filled ? colour : GREY};border-radius:4px;padding:9px 11px">` +
    `<a href="${href}" style="display:block;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:20px">&#9733;</a>` +
    `</td>`
  );
}

export function reviewStars(url: string): { html: string; text: string } {
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const rows = ROWS.map(
    (row) =>
      `<tr>${[1, 2, 3, 4, 5]
        .map((star) => cell(star <= row.stars, row.colour, href))
        .join("")}</tr>`
  ).join("");

  return {
    /*
     * No align="left": that floats the table and the button wraps around it
     * instead of sitting below. A plain table clears on its own.
     */
    html:
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
      `style="border-collapse:separate;border-spacing:6px 6px;margin:6px 0 12px">${rows}</table>`,
    text: ROWS.map(
      (row) =>
        `${row.stars} ${row.stars === 1 ? "star" : "stars"}: ${url}`
    ).join("\n"),
  };
}
