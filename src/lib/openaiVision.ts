import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const SYSTEM_PROMPT = `Tu es expert·e en visuels d’architecture. Analyse 1 rendu (image).
- Décris seulement ce qui est visible (aucune invention).
- NE propose AUCUN mouvement caméra.
- Retourne UNIQUEMENT un JSON valide conforme au JSON Schema fourni.
- Si un champ est incertain, écris "unknown" ou laisse vide.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    scene_summary: { type: "string" },
    property_type: { type: "string" },
    space_type: { type: "string" },
    style_tags: { type: "array", items: { type: "string" } },
    materials: { type: "array", items: { type: "string" } },
    color_palette: { type: "array", items: { type: "string" } },
    lighting: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: { type: "string" },
        time_of_day: { type: "string" },
        notes: { type: "string" }
      },
      required: ["type", "time_of_day"]
    },
    camera_estimate: {
      type: "object",
      additionalProperties: false,
      properties: {
        angle: { type: "string" },
        fov_mm: { type: "string" },
        height: { type: "string" }
      }
    },
    people_presence: { type: "boolean" },
    constraints: { type: "array", items: { type: "string" } }
  },
  required: [
    "scene_summary","property_type","space_type",
    "style_tags","materials","color_palette",
    "lighting","people_presence","constraints"
  ]
};

export async function analyzeImageFromUrl(imageUrl: string) {
  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" }, // JSON simple (on valide ensuite)
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse ce rendu et renvoie UNIQUEMENT un JSON valide." },
          { type: "image_url", image_url: { url: imageUrl } }
        ] as any
      }
    ]
  });

  const text = r.choices[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // fallback : entoure d'accolades si nécessaire
    parsed = {};
  }

  // mini-validation de structure (on ne s'arrête pas si des champs manquent)
  if (typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};
  parsed.scene_summary ??= "";
  parsed.property_type ??= "other";
  parsed.space_type ??= "other";
  parsed.style_tags ??= [];
  parsed.materials ??= [];
  parsed.color_palette ??= [];
  parsed.lighting ??= { type: "unknown", time_of_day: "unknown" };
  parsed.people_presence ??= false;
  parsed.constraints ??= ["preserve geometry","keep verticals straight","no hallucinated objects"];
  
return parsed;
}
  
  
export async function analyzeImageFromBase64(imageBase64: string, mime = "image/jpeg") {
  // Variante "chat" compatible : on envoie une data URL base64
  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse ce rendu et renvoie UNIQUEMENT un JSON valide." },
          { type: "image_url", image_url: { url: `data:${mime};base64,${imageBase64}` } as any }
        ] as any
      }
    ]
  });

  const text = r.choices[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};
  parsed.scene_summary ??= "";
  parsed.property_type ??= "other";
  parsed.space_type ??= "other";
  parsed.style_tags ??= [];
  parsed.materials ??= [];
  parsed.color_palette ??= [];
  parsed.lighting ??= { type: "unknown", time_of_day: "unknown" };
  parsed.people_presence ??= false;
  parsed.constraints ??= ["preserve geometry","keep verticals straight","no hallucinated objects"];

  return parsed;
}
