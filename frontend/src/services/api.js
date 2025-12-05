const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api";

const STREAMLIT_DEFAULTS = {
  color_palette: [
    "pastel pinks",
    "jewel tones",
    "metallic gold & black",
    "earthy autumn shades",
  ],
  pattern: [
    "stripes",
    "chevrons",
    "damask",
    "watercolor wash",
    "geometric lattice",
  ],
  motif: ["pumpkins", "bats", "florals", "stars", "waves", "shells"],
  style: [
    "whimsical gothic",
    "festive holiday sparkle",
    "coastal summer",
    "rustic harvest",
  ],
  finish: ["matte", "foil stamping", "embossed texture", "glossy lacquer"],
};

async function http(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorDetail = await safeJson(response);
    const message =
      errorDetail?.message ||
      errorDetail?.detail ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return safeJson(response);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

function mapOptions(payload) {
  if (!payload || typeof payload !== "object") {
    return STREAMLIT_DEFAULTS;
  }

  return {
    color_palette: Array.isArray(payload.color_palette)
      ? payload.color_palette
      : STREAMLIT_DEFAULTS.color_palette,
    pattern: Array.isArray(payload.pattern)
      ? payload.pattern
      : STREAMLIT_DEFAULTS.pattern,
    motif: Array.isArray(payload.motif)
      ? payload.motif
      : STREAMLIT_DEFAULTS.motif,
    style: Array.isArray(payload.style)
      ? payload.style
      : STREAMLIT_DEFAULTS.style,
    finish: Array.isArray(payload.finish)
      ? payload.finish
      : STREAMLIT_DEFAULTS.finish,
  };
}

export async function fetchDesignOptions() {
  try {
    const data = await http("/options");
    return mapOptions(data);
  } catch (error) {
    console.warn("Falling back to default options:", error);
    return STREAMLIT_DEFAULTS;
  }
}

export async function fetchRecentImages() {
  try {
    const data = await http("/images/recent");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.info("No recent images available:", error);
    return [];
  }
}

export async function generateDesigns(payload) {
  try {
    const result = await http("/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    console.log(result);
    return result || { image_sets: [] };
  } catch (error) {
    throw new Error(
      error.message ||
        "Unable to reach the generation service. Check that the backend is running."
    );
  }
}

export async function loadImageMetadata(imageId) {
  try {
    return await http(`/images/${encodeURIComponent(imageId)}`);
  } catch (error) {
    throw new Error(error.message || "Could not load the requested image.");
  }
}

export async function removeImage(imageId) {
  try {
    await http(`/images/${encodeURIComponent(imageId)}`, {
      method: "DELETE",
    });
  } catch (error) {
    throw new Error(
      error.message || "Unable to delete the image at this moment."
    );
  }
}

export async function requestImageEdit(payload) {
  try {
    return await http("/images/edit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      error.message || "Unable to apply the edit to this image right now."
    );
  }
}
