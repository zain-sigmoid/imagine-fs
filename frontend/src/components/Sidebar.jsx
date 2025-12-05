function RecentImages({ recentImages, onUseImage, onDeleteImage, loading }) {
  return (
    <div className="section-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 text-dark mb-0">
          <i className="fa-solid fa-clock-rotate-left me-2 text-primary"></i>
          Recent Images
        </h2>
        <span className="badge text-bg-light text-dark">
          {recentImages.length}
        </span>
      </div>
      {recentImages.length === 0 ? (
        <p className="text-muted small mb-0">
          Your latest generations will appear here for quick re-use. Run a
          concept to begin the gallery.
        </p>
      ) : (
        <ul className="list-group list-group-flush">
          {recentImages.map((item) => {
            console.log(item);
            const identifier = item.id || item.saved_path || item.path;
            const timeLabel =
              item.created_at &&
              new Date(item.created_at).toLocaleString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                month: "short",
                day: "numeric",
              });
            return (
              <li
                className="list-group-item px-0 d-flex align-items-center gap-3"
                key={identifier}
              >
                <div className="flex-shrink-0">
                  {item.data_b64 ? (
                    <img
                      // src={item.thumbnail || item.url}
                      src={`data:${item.mime_type};base64,${item.data_b64}`}
                      alt={item.filename || "Previous design"}
                      className="rounded-3 border"
                      width="64"
                      height="64"
                    />
                  ) : (
                    <div className="rounded-3 border bg-light d-flex align-items-center justify-content-center text-muted">
                      <i className="fa-regular fa-image px-3 py-2"></i>
                    </div>
                  )}
                </div>
                <div className="flex-grow-1">
                  <p className="mb-1 small fw-semibold text-dark">
                    {item.filename || "Unnamed napkin"}
                  </p>
                  {timeLabel && (
                    <p className="mb-0 small text-muted">{timeLabel}</p>
                  )}
                </div>
                <div className="d-flex flex-column gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => onUseImage(identifier)}
                    disabled={loading}
                  >
                    <i className="fa-solid fa-rotate me-1"></i>
                    Use
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onDeleteImage(identifier)}
                    disabled={loading}
                  >
                    <i className="fa-solid fa-trash me-1"></i>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EditPanel({
  imageSets,
  selectedComboIndex,
  onComboChange,
  editPrompt,
  onEditPromptChange,
  onEditSubmit,
  activeVariant,
  onVariantChange,
  loading,
}) {
  const options = imageSets.map((set, index) => {
    const combo = set.combo || {};
    const labelParts = [combo.motif, combo.pattern]
      .filter(Boolean)
      .map((part) => String(part).replace("Default", "").trim())
      .filter(Boolean);
    const label = labelParts.length
      ? `Combo ${index + 1} · ${labelParts.join(" × ")}`
      : `Combo ${index + 1}`;
    return {
      value: index,
      label,
    };
  });

  const variants = [
    { key: "original", label: "Original" },
    { key: "low", label: "Low" },
    { key: "medium", label: "Medium" },
    { key: "high", label: "High" },
  ];

  if (imageSets[selectedComboIndex]?.edited) {
    variants.push({ key: "edited", label: "Edited" });
  }

  return (
    <div className="section-card p-4">
      <h2 className="h5 text-dark mb-3">
        <i className="fa-solid fa-pen-clip me-2 text-primary"></i>
        Quick Edit
      </h2>
      {imageSets.length === 0 ? (
        <p className="text-muted small mb-0">
          Generate or load a concept to unlock guided editing tools. You can
          refine colour, motif, or finishing touches with a simple prompt.
        </p>
      ) : (
        <>
          <div className="mb-3">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Choose combination
            </label>
            <select
              className="form-select"
              value={selectedComboIndex}
              onChange={(event) => onComboChange(Number(event.target.value))}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Base variant
            </label>
            <div className="d-flex flex-wrap gap-2">
              {variants.map((variant) => (
                <button
                  type="button"
                  key={variant.key}
                  className={`btn btn-sm ${
                    (activeVariant[selectedComboIndex] || "original") ===
                    variant.key
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() =>
                    onVariantChange(selectedComboIndex, variant.key)
                  }
                >
                  {variant.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Edit prompt
            </label>
            <textarea
              className="form-control"
              rows="3"
              value={editPrompt}
              onChange={(event) => onEditPromptChange(event.target.value)}
              placeholder="E.g. brighten the background, add gold foil monogram on the centre, soften the stripes."
            ></textarea>
          </div>

          <button
            type="button"
            className="btn btn-success w-100 btn-icon"
            onClick={onEditSubmit}
            disabled={loading}
          >
            <i className="fa-solid fa-wand-magic"></i>
            {loading ? "Applying…" : "Apply Edit"}
          </button>
        </>
      )}
    </div>
  );
}

function Sidebar(props) {
  return (
    <aside className="sticky-sidebar">
      <RecentImages {...props} />
      <EditPanel {...props} />
    </aside>
  );
}

export default Sidebar;
