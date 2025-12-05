const ENHANCEMENT_CHOICES = [
  { value: "Low", label: "Low", icon: "fa-moon" },
  { value: "Medium", label: "Medium", icon: "fa-sun" },
  { value: "High", label: "High", icon: "fa-star" },
];

const FIELD_CONFIG = [
  {
    name: "color_palette",
    label: "Color Palette",
    icon: "fa-palette",
  },
  {
    name: "pattern",
    label: "Pattern",
    icon: "fa-grip-lines",
  },
  {
    name: "motif",
    label: "Motif",
    icon: "fa-splotch",
  },
  {
    name: "style",
    label: "Style",
    icon: "fa-swatchbook",
  },
  {
    name: "finish",
    label: "Finish",
    icon: "fa-sparkles",
  },
];

function PromptBuilder({
  themes,
  theme,
  onThemeChange,
  enhancement,
  onEnhancementChange,
  catalog,
  selections,
  onSelectionsChange,
  extraDetail,
  onExtraDetailChange,
  onSubmit,
  loading,
}) {
  const handleSelection = (name, value) => {
    onSelectionsChange({
      ...selections,
      [name]: value,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (loading) return;
    onSubmit();
  };

  return (
    <section className="section-card p-4 p-lg-5 mb-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="h4 fw-semibold mb-0 text-dark">Creative Direction</h2>
          <p className="text-muted mb-0">
            Select a hosting vibe, dial in the render strength, and layer any
            signature details you want to emphasise.
          </p>
        </div>
        <span className="badge rounded-pill text-bg-secondary">
          <i className="fa-solid fa-sliders me-2"></i>
          Guided Controls
        </span>
      </div>

      <form className="needs-validation" onSubmit={handleSubmit} noValidate>
        <div className="row g-4">
          <div className="col-12">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Theme
            </label>
            <div className="input-group input-group-lg">
              <span className="input-group-text">
                <i className="fa-solid fa-martini-glass-citrus text-primary"></i>
              </span>
              <select
                className="form-select"
                value={theme}
                onChange={(event) => onThemeChange(event.target.value)}
                required
              >
                {themes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label text-uppercase small text-muted fw-semibold">
              Enhancement Level
            </label>
            <div className="row g-2">
              {ENHANCEMENT_CHOICES.map((choice) => (
                <div className="col-12 col-sm-4" key={choice.value}>
                  <button
                    type="button"
                    className={`btn btn-outline-primary w-100 ${
                      enhancement === choice.value ? "active" : ""
                    }`}
                    onClick={() => onEnhancementChange(choice.value)}
                    disabled={loading}
                  >
                    <div className="d-flex flex-column align-items-center py-1">
                      <i className={`fa-solid ${choice.icon} fs-5 mb-1`}></i>
                      <span className="small fw-semibold">
                        {choice.value === enhancement
                          ? "Selected"
                          : choice.label}
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
            <small className="text-muted d-block mt-2">
              Medium is perfect for previewing most concepts. High adds drama
              and finishing touches.
            </small>
          </div>

          <div className="col-md-6">
            <div className="p-3 bg-light rounded-3 h-100">
              <h3 className="h6 text-dark text-uppercase fw-semibold mb-2">
                Smart Defaults
              </h3>
              <p className="small text-muted mb-0">
                Leave any selection on <strong>Default</strong> to let the
                system explore the best trio of combinations for your theme.
                Mixing your own picks gives the AI extra direction.
              </p>
            </div>
          </div>
        </div>

        <hr className="my-4" />

        <div className="row g-3">
          {FIELD_CONFIG.map((field) => (
            <div className="col-12 col-lg-6" key={field.name}>
              <label className="form-label fw-semibold text-muted text-uppercase small mb-1">
                {field.label}
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className={`fa-solid ${field.icon}`}></i>
                </span>
                <select
                  className="form-select"
                  value={selections[field.name]}
                  onChange={(event) =>
                    handleSelection(field.name, event.target.value)
                  }
                >
                  <option value="Default">Default</option>
                  {(catalog[field.name] || []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="form-label text-uppercase small text-muted fw-semibold">
            Extra Detail (optional)
          </label>
          <textarea
            className="form-control"
            rows="3"
            value={extraDetail}
            onChange={(event) => onExtraDetailChange(event.target.value)}
            placeholder="Add any art direction cues (e.g. soft gold shimmer, hand-lettered typography)."
          ></textarea>
        </div>

        <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mt-4">
          <div className="text-muted small">
            <i className="fa-solid fa-lightbulb text-warning me-2"></i>
            You can revisit and edit the generated pieces in the sidebar.
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-icon px-4"
            disabled={loading}
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i>
            {loading ? "Working…" : "Generate Concepts"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default PromptBuilder;
