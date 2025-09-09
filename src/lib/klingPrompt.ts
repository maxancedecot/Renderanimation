// src/lib/klingPrompt.ts

// --- Types attendus par le générateur de prompt ---
export type Analysis = {
  scene_summary?: string;
  property_type?: string;     // ex: apartment | house | villa | office | retail | exterior | other
  space_type?: string;        // ex: living_room | kitchen | bedroom | bathroom | terrace | lobby | facade | other
  style_tags?: string[];
  materials?: string[];
  color_palette?: string[];
  lighting?: { type?: string; time_of_day?: string; notes?: string };
};

/**
 * Nettoie/normalise les champs de l'analyse pour éviter les "undefined" dans le prompt.
 */
function normalizeAnalysis(a: Analysis) {
  const safe = (v?: string) => (v && v.trim().length ? v.trim() : "");
  const list = (xs?: string[]) => (Array.isArray(xs) && xs.length ? xs : []);

  return {
    scene_summary: safe(a.scene_summary),
    property_type: safe(a.property_type) || "other",
    space_type: safe(a.space_type) || "other",
    style_tags: list(a.style_tags),
    materials: list(a.materials),
    color_palette: list(a.color_palette),
    lighting: {
      type: safe(a.lighting?.type) || "",
      time_of_day: safe(a.lighting?.time_of_day) || "",
      notes: safe(a.lighting?.notes) || "",
    },
  };
}

/**
 * Transforme l'analyse en prompt KlingAI en imposant un "glide avant lent" (dolly-in subtil).
 * @param ana   Résultat d'analyse (OpenAI vision)
 * @param opts  Options d'export (durée, fps, ratio)
 */
export function createPromptFromAnalysis(
  ana: Analysis,
  opts?: { durationSec?: number; fps?: number; aspect?: string }
) {
  const n = normalizeAnalysis(ana);

  const duration = opts?.durationSec ?? 7;
  const fps = opts?.fps ?? 24;
  const aspect = opts?.aspect ?? "16:9";

  const listToStr = (xs?: string[]) => (xs && xs.length ? xs.join(", ") : "—");

  // Construit proprement la ligne "Lighting"
  const lightingParts = [n.lighting.type, n.lighting.time_of_day]
    .filter(Boolean)
    .join(", ");
  const lightingLine = n.lighting.notes
    ? `${lightingParts}${lightingParts ? " " : ""}(${n.lighting.notes})`
    : lightingParts;

  // Si pas de résumé, essaie d'en déduire un minimal à partir de property/space
  const scene =
    n.scene_summary ||
    (n.space_type !== "other" ? `A ${n.space_type} scene` : "") ||
    (n.property_type !== "other" ? `A ${n.property_type} space` : "") ||
    "";

  return `Animate this architectural render while strictly preserving geometry, materials, layout, colors, and lighting from the source image.

Scene: ${scene}
Property: ${n.property_type} – ${n.space_type}
Style: ${listToStr(n.style_tags)}
Materials/colors to respect: ${listToStr(n.materials)}; ${listToStr(n.color_palette)}
Lighting: ${lightingLine}

Camera & Motion (FIXED):
- Perform a very slow, steady forward glide (subtle dolly-in) along the current viewing axis.
- Keep verticals perfectly straight, no parallax exaggeration, no tilt, no roll.
- No lateral pans, no orbits, no zoom jumps.

Timing:
- Duration: ${duration}s
- 0.5s hold → constant forward motion → 0.5s settle.

Constraints:
- Preserve architecture and materials exactly.
- No new objects, no people.
- No flicker or texture crawling; no warping lines.

Output: ${fps} fps, ${aspect}.`;
}