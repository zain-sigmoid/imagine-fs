const VARIANT_OPTIONS = [
  { key: "original", label: "Original", icon: "fa-image" },
  { key: "low", label: "Low Enhanced", icon: "fa-circle-half-stroke" },
  { key: "medium", label: "Medium", icon: "fa-circle" },
  { key: "high", label: "High", icon: "fa-sun" },
];

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

  if (variants && Object.prototype.hasOwnProperty.call(variants, variantKey)) {
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

function ResultCard({
  imageSet,
  index,
  isActive,
  onActivate,
  activeVariant,
  onVariantChange,
}) {
  const {
    combo = {},
    prompt,
    rationale,
    saved_path: savedPath,
  } = imageSet || {};

  const displayVariant = activeVariant || "original";
  let previewSrc = getVariantSource(imageSet, displayVariant);
  if (!previewSrc && displayVariant !== "original") {
    previewSrc = getVariantSource(imageSet, "original");
  }

  const detailItems = Object.entries(combo)
    .filter(([key, value]) => value && value !== "Default" && key !== "rationale")
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
    <article
      className={`section-card p-4 mb-4 ${isActive ? "border-primary border-2" : ""}`}
    >
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div>
          <span className="badge rounded-pill text-bg-primary mb-2">
            Combo {index + 1}
          </span>
          <h3 className="h5 text-dark mb-1">
            {detailItems.length
              ? detailItems
                  .slice(0, 2)
                  .map((item) => item.value)
                  .join(" · ")
              : "Auto-selected mix"}
          </h3>
          {rationale && (
            <p className="text-muted small mb-0">
              <i className="fa-solid fa-comment-dots me-2 text-info"></i>
              {rationale}
            </p>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm ${
              isActive ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => onActivate(index)}
          >
            <i className="fa-solid fa-eye me-2"></i>
            Focus
          </button>
          {savedPath && (
            <a
              href={savedPath}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm btn-outline-secondary"
            >
              <i className="fa-solid fa-download me-2"></i>
              Download Original
            </a>
          )}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-7">
          <div className="ratio ratio-1x1 overflow-hidden rounded-4 border border-light-subtle">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={`Preview for combo ${index + 1}`}
                className="w-100 h-100 object-fit-cover"
              />
            ) : (
              <div className="d-flex align-items-center justify-content-center bg-light">
                <div className="text-center text-muted">
                  <i className="fa-regular fa-image fa-2xl mb-2"></i>
                  <p className="mb-0 small">Preview not available yet.</p>
                </div>
              </div>
            )}
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
              </li>
            )}
            {detailItems.map((item) => (
              <li className="list-group-item text-capitalize" key={item.label}>
                <strong className="text-secondary">{item.label}:</strong>{" "}
                <span className="text-dark">{item.value}</span>
              </li>
            ))}
          </ul>

          {prompt && (
            <details className="mt-3">
              <summary className="text-muted small fw-semibold">
                Prompt used
              </summary>
              <p className="small text-dark mt-2 mb-0">{prompt}</p>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}

function ResultsGallery({
  imageSets,
  selectedComboIndex,
  onSelectedComboChange,
  activeVariant,
  onVariantChange,
  loading,
}) {
  if (!imageSets.length) {
    return (
      <section className="section-card p-5 text-center text-muted">
        <i className="fa-solid fa-sparkles fa-2xl mb-3 text-primary"></i>
        <h2 className="h5 fw-semibold text-dark">Ready when you are</h2>
        <p className="mb-0">
          Choose a theme and tap <strong>Generate Concepts</strong> to see
          tailored napkin designs with enhancement previews.
        </p>
      </section>
    );
  }

  return (
    <section aria-live="polite">
      {imageSets.map((imageSet, index) => (
        <ResultCard
          key={imageSet.id || index}
          imageSet={imageSet}
          index={index}
          isActive={index === selectedComboIndex}
          onActivate={onSelectedComboChange}
          activeVariant={activeVariant[index]}
          onVariantChange={onVariantChange}
        />
      ))}
      {loading && (
        <div className="text-center text-muted my-4">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="small mt-2 mb-0">Processing your request…</p>
        </div>
      )}
    </section>
  );
}

export default ResultsGallery;
