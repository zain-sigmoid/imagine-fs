import { useMemo, useState } from "react";
import { userContext } from "./userContext";

function uniqueById(list = []) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item?.id ?? JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const UserState = ({ children }) => {
  const [imageSets, setImageSets] = useState([]);
  const [recentImages, setRecentImages] = useState([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [relatedImages, setRelatedImages] = useState([]);
  const [relatedTotal, setRelatedTotal] = useState(0);
  const [activeVariant, setActiveVariant] = useState({});
  const [selectedComboIndex, setSelectedComboIndex] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
      color_palette: Array.isArray(payload.color_palettes)
        ? payload.color_palettes
        : STREAMLIT_DEFAULTS.color_palette,
      pattern: Array.isArray(payload.patterns)
        ? payload.patterns
        : STREAMLIT_DEFAULTS.pattern,
      motif: Array.isArray(payload.motifs)
        ? payload.motifs
        : STREAMLIT_DEFAULTS.motif,
      style: Array.isArray(payload.styles)
        ? payload.styles
        : STREAMLIT_DEFAULTS.style,
      finish: Array.isArray(payload.finishes)
        ? payload.finishes
        : STREAMLIT_DEFAULTS.finish,
    };
  }

  async function fetchDesignOptions() {
    try {
      const data = await http("/options");
      return mapOptions(data);
    } catch (error) {
      console.warn("Falling back to default options:", error);
      return STREAMLIT_DEFAULTS;
    }
  }

  async function fetchRecentImages({ offset = 0, limit = 6 } = {}) {
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      }).toString();
      const data = await http(`/recent-images?${params}`);

      if (data?.status === false) {
        console.info("No recent images:", data.message);

        // Clear state
        setRecentImages([]);
        setRecentTotal(0);

        return { items: [], total: 0, has_more: false };
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      const total =
        typeof data?.total === "number"
          ? data.total
          : Array.isArray(data)
          ? data.length
          : 0;
      if (offset === 0) {
        setRecentImages(uniqueById(items));
      } else {
        setRecentImages((prev) => uniqueById([...prev, ...items]));
      }
      setRecentTotal(total);

      const hasMore = offset + limit < total && items.length > 0;
      return { items, total, has_more: hasMore };
    } catch (error) {
      console.info("No recent images available:", error);
      return { items: [], total: 0, has_more: false };
    }
  }

  async function fetchRelatedImages(payload, { offset = 0, limit = 12 } = {}) {
    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(limit),
      }).toString();
      const body = {
        id: payload.id,
        theme: payload.theme,
        selections: payload.selections,
        type: payload.type || payload.enhancement,
      };
      const data = await http(`/related-images?${params}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (data && Array.isArray(data.items)) {
        return data;
      }
      return { items: [], has_more: false, next_offset: offset, total: 0 };
    } catch (error) {
      console.info("No related images available:", error);
      return { items: [], has_more: false, next_offset: offset, total: 0 };
    }
  }

  async function loadRelatedImages(
    payload,
    { offset = 0, limit = 6, append = false } = {}
  ) {
    console.log("payload before fetching", payload);
    const data = await fetchRelatedImages(payload, { offset, limit });
    setRelatedImages((prev) =>
      append
        ? uniqueById([...prev, ...(data.items || [])])
        : uniqueById(data.items || [])
    );
    setRelatedTotal(data.total || 0);
    return data;
  }

  async function loadRecentImages({
    offset = 0,
    limit = 6,
    append = false,
  } = {}) {
    const data = await fetchRecentImages({ offset, limit });
    setRecentImages((prev) =>
      append
        ? uniqueById([...prev, ...(data.items || [])])
        : uniqueById(data.items || [])
    );
    setRecentTotal(data.total || 0);
    return data;
  }

  async function generateDesigns(payload) {
    try {
      const result = await http("/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return result || { image_sets: [] };
    } catch (error) {
      throw new Error(
        error.message ||
          "Unable to reach the generation service. Check that the backend is running."
      );
    }
  }

  async function loadImageMetadata(imageId) {
    try {
      return await http(`/images/${encodeURIComponent(imageId)}`);
    } catch (error) {
      throw new Error(error.message || "Could not load the requested image.");
    }
  }

  async function removeImage(imageId) {
    try {
      const res = await http(`/delete?imageId=${imageId}`, {
        method: "DELETE",
      });
      return res;
    } catch (error) {
      throw new Error(
        error.message || "Unable to delete the image at this moment."
      );
    }
  }

  async function removeAll() {
    try {
      const res = await http(`/delete-all`, {
        method: "DELETE",
      });
      return res;
    } catch (error) {
      throw new Error(
        error.message || "Unable to delete all the images at this moment."
      );
    }
  }

  async function requestImageEdit(payload) {
    try {
      const data = await http("/edit", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return data;
    } catch (error) {
      throw new Error(
        error.message || "Unable to apply the edit to this image right now."
      );
    }
  }

  async function streamGenerateDesigns(
    payload,
    { onPrompt, onVariant, onSummary, onError, onDone, signal } = {}
  ) {
    const controller = new AbortController();
    const response = await fetch(`${API_BASE_URL}/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: signal || controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(
        `Streaming request failed with status ${response.status}`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let doneSeen = false;
    const parseLine = (line) => {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line);
        switch (event.event) {
          case "prompt":
            onPrompt?.(event.data);
            break;
          case "image_variant":
            onVariant?.(event.data);
            break;
          case "error":
            onError?.(event.data);
            break;
          case "done":
            doneSeen = true;
            onDone?.(event.data);
            break;
          default:
            break;
        }
      } catch (err) {
        onError?.({ message: "Malformed stream data" });
      }
    };

    const done = (async () => {
      try {
        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            parseLine(line);
          }
        }
        if (buffer.trim()) {
          parseLine(buffer);
        }
        if (!doneSeen) {
          onDone?.();
        }
      } catch (err) {
        if (err.name === "AbortError") {
          if (!doneSeen) {
            onDone?.();
          }
          return;
        }
        onError?.({ message: err.message || "Streaming failed" });
        throw err;
      }
    })();

    return {
      cancel: () => controller.abort(),
      done,
    };
  }
  async function downloadImage(imageId, level = "org") {
    try {
      const url = `${API_BASE_URL}/download?imageId=${encodeURIComponent(
        imageId
      )}&level=${encodeURIComponent(level)}`;

      // Fetch as a blob
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to download image.");

      const blob = await response.blob();

      // Extract filename from headers
      let filename = "download.png";
      const disposition = response.headers.get("Content-Disposition");
      console.log(disposition);
      if (disposition && disposition.includes("filename=")) {
        filename = disposition.split("filename=")[1].replace(/"/g, "").trim();
      }

      // Create a blob link
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // cleanup
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
    }
  }

  const value = useMemo(
    () => ({
      fetchDesignOptions,
      fetchRecentImages,
      fetchRelatedImages,
      loadRelatedImages,
      loadRecentImages,
      generateDesigns,
      loadImageMetadata,
      removeImage,
      requestImageEdit,
      streamGenerateDesigns,
      imageSets,
      setImageSets,
      recentImages,
      setRecentImages,
      recentTotal,
      setRecentTotal,
      activeVariant,
      setActiveVariant,
      selectedComboIndex,
      setSelectedComboIndex,
      editPrompt,
      setEditPrompt,
      relatedImages,
      setRelatedImages,
      relatedTotal,
      setRelatedTotal,
      downloadImage,
      removeAll,
    }),
    [
      imageSets,
      recentImages,
      recentTotal,
      activeVariant,
      selectedComboIndex,
      editPrompt,
      relatedImages,
      relatedTotal,
    ]
  );

  return <userContext.Provider value={value}>{children}</userContext.Provider>;
};

export default UserState;
