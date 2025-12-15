import React, { useLayoutEffect } from "react";
import "../styling/card.css";
import "../styling/head.css";
import { TYPE_ICON } from "../../../config/icons";
import ViewModal from "../../../components/modals/ViewModal";

const ResultCard = ({
  imageSet,
  index,
  isActive,
  onActivate,
  activeVariant,
  onVariantChange,
  downloadImage,
  editPrompt,
}) => {
  const { combo = {}, rationale, id, theme, type, variants } = imageSet || {};

  const VARIANT_OPTIONS = [
    { key: "original", label: "Original", icon: "fa-image" },
    { key: "low", label: "Low Enhanced", icon: "fa-circle-half-stroke" },
    { key: "medium", label: "Medium", icon: "fa-circle" },
    { key: "high", label: "High", icon: "fa-sun" },
  ];

  useLayoutEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
    );
  }, []);

  function resolveImageSource(source) {
    if (!source) return null;

    if (typeof source === "string") {
      const trimmed = source.trim();
      if (!trimmed) return null;

      const sanitised = trimmed.replace(/\s+/g, "");
      const looksLikeBase64 =
        sanitised.length > 80 && /^[a-z0-9+/=]+$/i.test(sanitised);

      if (looksLikeBase64) {
        return `data:image/png;base64,${sanitised}`;
      }

      const lower = trimmed.toLowerCase();
      if (
        lower.startsWith("data:") ||
        lower.startsWith("http://") ||
        lower.startsWith("https://") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("/") ||
        trimmed.startsWith("./") ||
        trimmed.startsWith("../")
      ) {
        return trimmed;
      }

      return trimmed;
    }

    if (typeof source === "object") {
      const {
        data_b64: dataB64Snake,
        dataB64,
        mime_type: mimeSnake,
        mimeType,
        url,
        src,
      } = source;

      const payload = dataB64Snake || dataB64;
      const mime = mimeSnake || mimeType || "image/png";

      if (payload) {
        return `data:${mime};base64,${payload}`;
      }

      if (typeof url === "string") return url;
      if (typeof src === "string") return src;
    }

    return null;
  }

  function getVariantSource(imageSet, variantKey) {
    if (!imageSet) return null;

    const variants = imageSet.variants || imageSet.enhanced || {};
    const candidates = [];

    if (
      variants &&
      Object.prototype.hasOwnProperty.call(variants, variantKey)
    ) {
      candidates.push(variants[variantKey]);
    }

    candidates.push(imageSet?.[variantKey]);

    if (variantKey === "original") {
      candidates.push(
        imageSet.original,
        imageSet.original_url,
        imageSet.url,
        imageSet.saved_path
      );
    }

    if (variantKey === "edited") {
      candidates.push(imageSet.edited, imageSet.edited_url);
    }

    if (imageSet.enhanced) {
      const enhancedCandidate = imageSet.enhanced[variantKey];
      if (enhancedCandidate) {
        candidates.push(enhancedCandidate);
      }
    }

    for (const candidate of candidates) {
      const resolved = resolveImageSource(candidate);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  const displayVariant = activeVariant || "original";
  let previewSrc = getVariantSource(imageSet, displayVariant);
  if (!previewSrc && displayVariant !== "original") {
    previewSrc = getVariantSource(imageSet, "original");
  }
  const rationaleF = rationale || combo.rationale || null;
  const detailItems = Object.entries(combo)
    .filter(
      ([key, value]) => value && value !== "Default" && key !== "rationale"
    )
    .map(([key, value]) => ({
      label: key.replaceAll("_", " "),
      value,
    }));

  const variantButtons = [...VARIANT_OPTIONS];
  if (getVariantSource(imageSet, "edited")) {
    variantButtons.push({
      key: "edited",
      label: "Edited",
      icon: "fa-pen-to-square",
    });
  }

  return (
    <div className="row g-4">
      <ViewModal previewSrc={previewSrc} index={index} />
      <div className="col-md-7">
        <div className="ratio ratio-1x1 overflow-hidden rounded-4 border border-light-subtle position-relative">
          {previewSrc ? (
            <>
              <img
                src={previewSrc}
                alt={`Preview for combo ${index + 1}`}
                className="img-fluid ratio-image-zoom"
              />
              <div className="ratio-overlay">
                <div className="overlay-text">{theme}</div>
                <div className="overlay-text">
                  <i className={`fa-solid ${TYPE_ICON[type]}  me-1`}></i>
                  {type}
                </div>
              </div>
            </>
          ) : (
            <div className="d-flex align-items-center justify-content-center bg-light">
              <div className="text-center text-muted">
                <i className="fa-regular fa-image fa-2xl mb-2"></i>
                <p className="mb-0 small">No Preview..</p>
              </div>
            </div>
          )}
          <div className="position-absolute top-0 start-0 end-0 p-2">
            <div className="glass-icon-circle">
              <i
                className="fa-solid fa-info fa-xs"
                data-bs-toggle="tooltip"
                data-bs-placement="top"
                // data-bs-custom-class="custom-tooltip"
                data-bs-title="Hover on image to view theme and type"
              ></i>
            </div>
          </div>
        </div>
      </div>
      <div className="col-md-5">
        <div className="d-flex flex-wrap gap-2 mb-3">
          {variantButtons.map((option) => (
            <button
              type="button"
              key={option.key}
              className={`btn btn-sm ${
                displayVariant === option.key
                  ? "btn-primary"
                  : "btn-outline-primary"
              }`}
              onClick={() => onVariantChange(index, option.key)}
            >
              <i className={`fa-solid ${option.icon} me-2`}></i>
              {option.label}
            </button>
          ))}
        </div>

        <ul className="list-group list-group-flush small">
          {detailItems.length === 0 && (
            <li className="list-group-item">
              <i className="fa-solid fa-wand-magic-sparkles text-primary me-2"></i>
              AI-curated combination
              <li className="list-group-item text-capitalize" key={0}>
                <strong className="text-secondary">Labels:</strong>{" "}
                <span className="text-dark">All are Default</span>
              </li>
            </li>
          )}
          {detailItems.map((item) => (
            <li className="list-group-item text-capitalize" key={item.label}>
              <strong className="text-secondary">{item.label}:</strong>{" "}
              <span className="text-dark">{item.value}</span>
            </li>
          ))}
        </ul>
        <aside className="d-flex justify-content-end align-items-center mt-4">
          <div
            class="btn-group"
            role="group"
            aria-label="Basic outlined example"
          >
            <button
              className="btn btn-outline-success btn-sm"
              type="button"
              data-bs-toggle="modal"
              data-bs-target="#viewModal"
              style={{ fontSize: "12px" }}
            >
              <i className="fa-solid fa-eye fa-sm me-2"></i>
              View Image
            </button>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                downloadImage(id, displayVariant);
              }}
              style={{ fontSize: "12px" }}
            >
              <i className="fa-solid fa-download fa-sm me-2"></i>
              Download
            </button>
          </div>
        </aside>
      </div>
      <div className="d-flex justify-content-start gap-2">
        {rationaleF && (
          <div className="flex-grow-1">
            <div className="ms-2">
              <h5 className="text-secondary fw-semibold">Rationale</h5>
              <p className="text-muted small mb-0">
                <i class="fa-solid fa-align-justify me-2 text-info"></i>
                {rationaleF}
              </p>
            </div>
          </div>
        )}
        {variants?.edited && editPrompt && (
          <div className="flex-shrink-0">
            <div className="ms-3">
              <h5 className="text-secondary fw-semibold">Edit Prompt</h5>
              <p className="text-muted small mb-0">
                <i className="fa-solid fa-comment-dots me-2 text-info"></i>
                {editPrompt}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultCard;
