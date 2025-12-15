import { useContext, useEffect, useMemo, useState } from "react";
import { userContext } from "../context/userContext";
import { useNavigate } from "react-router-dom";
import { ICON_DICTIONARY } from "../config/icons";
import "./styling/selections.css";

const enhancementLevels = [
  { id: "cup", label: "Cup", icon: "fa-mug-hot" },
  { id: "plates", label: "Plates", icon: "fa-bowl-rice" },
  { id: "napkin", label: "Napkin", icon: "fa-note-sticky" },
];

const THEMES = [
  {
    value: "🍔 Backyard BBQs / Cookouts",
    icon: "fa-burger",
    title: "Backyard BBQs",
    tagline: "Smoky • Cozy • Fun",
  },
  {
    value: "🏊‍♂️ Pool parties",
    icon: "fa-person-swimming",
    title: "Pool Parties",
    tagline: "Splashy • Chill • Sunny",
  },
  {
    value: "🐣 Easter brunches",
    icon: "fa-egg",
    title: "Easter Brunches",
    tagline: "Bright • Playful • Fresh",
  },
  {
    value: "🎃 Halloween parties",
    icon: "fa-ghost",
    title: "Halloween Parties",
    tagline: "Spooky • Fun • Bold",
  },
  {
    value: "🎉 New Year’s brunch",
    icon: "fa-champagne-glasses",
    title: "New Year’s Brunch",
    tagline: "Sparkly • Festive • Fresh",
  },
  {
    value: "💼 Farewell or promotion parties at work",
    icon: "fa-briefcase",
    title: "Farewell & Promotion",
    tagline: "Warm • Proud • Together",
  },
];

const Selections = (props) => {
  const { showAlert } = props.prop;
  const {
    fetchDesignOptions,
    streamGenerateDesigns,
    loadRelatedImages,
    setImageSets,
    setActiveVariant,
    setSelectedComboIndex,
    setRelatedImages,
    setRelatedTotal,
    imageSets,
  } = useContext(userContext);
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0].value);
  const activeTheme =
    THEMES.find((t) => t.value === selectedTheme) || THEMES[0];

  const [enhancement, setEnhancement] = useState("cup");
  const [selections, setSelections] = useState({
    color_palette: "Default",
    pattern: "Default",
    motif: "Default",
    style: "Default",
    finish: "Default",
  });
  const [extraDetail, setExtraDetail] = useState("");
  const [options, setOptions] = useState({
    color_palette: [],
    pattern: [],
    motif: [],
    style: [],
    finish: [],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const designOptions = await fetchDesignOptions();
        setOptions(designOptions);
      } catch (error) {
        console.warn("Falling back to default design options", error);
      }
    };
    load();
  }, [fetchDesignOptions]);

  const catalog = useMemo(
    () => ({
      color_palette: options.color_palette ?? [],
      pattern: options.pattern ?? [],
      motif: options.motif ?? [],
      style: options.style ?? [],
      finish: options.finish ?? [],
    }),
    [options]
  );

  const handleGenerate = async () => {
    setLoading(true);
    setActiveVariant({});
    setSelectedComboIndex(0);
    setRelatedImages([]);
    setRelatedTotal(0);
    const payload = {
      theme: selectedTheme,
      enhancement,
      extraDetail,
      selections,
      catalog,
    };
    try {
      const stream = await streamGenerateDesigns(payload, {
        onPrompt: () => {},
        onVariant: ({ index, id, variant, image, rationale, combo }) => {
          let resolvedIndex = 0;
          setImageSets((prev) => {
            const next = [...prev];
            const hasIndex = Number.isInteger(index);
            const normalisedIndex =
              hasIndex && index >= 1 ? index - 1 : hasIndex ? index : null;
            const targetIndex =
              normalisedIndex !== null
                ? normalisedIndex
                : next.findIndex((i) => i.key === variant);
            resolvedIndex = targetIndex >= 0 ? targetIndex : next.length;
            const key = variant || `image-${resolvedIndex + 1}`;
            const existing = next[resolvedIndex] || {
              key,
              combo: combo || selections,
              variants: {},
              rationale: "",
              theme: payload.theme,
              type: payload.enhancement,
              id: id || null,
            };
            const imageId =
              id ||
              image?.id ||
              image?.image_id ||
              image?.saved_path ||
              existing.id ||
              null;
            const variants = { ...(existing.variants || {}) };
            if (variant && image) {
              variants[variant] = image;
            }
            next[resolvedIndex] = {
              ...existing,
              combo: combo || existing.combo || selections,
              variants,
              rationale: rationale ?? existing.rationale,
              theme: payload.theme,
              type: existing.type || payload.enhancement,
              id: imageId,
            };
            return next;
          });
          setActiveVariant((prev) => ({
            ...prev,
            // [resolvedIndex]: variant || prev[resolvedIndex] || "original",
            [resolvedIndex]: prev[resolvedIndex] || "original",
          }));
        },
        onDone: async (data) => {
          showAlert("Image generation complete.", "success");
          navigate("/gallery?generated-images");
          const { id, theme, combo, type } = data || {};
          await loadRelatedImages(
            {
              id: id || payload.id,
              theme: theme || payload.theme,
              selections: combo || selections,
              type: type || payload.enhancement,
            },
            { offset: 0, limit: 6 }
          );
        },
        onError: (data) => {
          const msg =
            data?.message || "Unable to stream designs. Please try again.";
          showAlert(msg, "danger");
        },
      });

      await stream.done;
    } catch (error) {
      console.error("Generation failed", error);
    } finally {
      setLoading(false);
    }
  };

  const selectionHandlers = {
    color_palette: (v) =>
      setSelections((prev) => ({ ...prev, color_palette: v })),
    pattern: (v) => setSelections((prev) => ({ ...prev, pattern: v })),
    motif: (v) => setSelections((prev) => ({ ...prev, motif: v })),
    style: (v) => setSelections((prev) => ({ ...prev, style: v })),
    finish: (v) => setSelections((prev) => ({ ...prev, finish: v })),
  };

  return (
    <div className="selection-page-bg ">
      <div className="creative-studio-wrapper p-4 p-md-5" id="select">
        <div className="container d-flex justify-content-center">
          <div className="creative-studio-container animate__animated animate__zoomIn">
            <span
              className="badge rounded-pill text-bg-secondary"
              onClick={() => navigate("/")}
              style={{ cursor: "pointer" }}
            >
              <i className="fa-solid fa-close me-2"></i>
              Close
            </span>
            {/* Header */}
            <div className="d-flex flex-column flex-md-row align-items-stretch justify-content-between mb-4 mt-3">
              <div className="p-2 h-100">
                <h1 className="display-6 fw-bold text-dark text-glow mb-1 ">
                  <i className="fa-solid fa-wand-magic-sparkles text-glow me-2"></i>
                  Creative Studio
                </h1>
                <p className="text-muted mb-0">
                  Select a hosting vibe, dial in the render strength, and layer
                  any signature details you want to emphasise.
                </p>
              </div>
              <div className="d-flex flex-column gap-2 h-100">
                <span className="badge rounded-pill text-bg-secondary mt-2">
                  <i className="fa-solid fa-sliders me-2"></i>
                  Guided Controls
                </span>
              </div>
            </div>

            {/* HERO THEME CARD */}
            <div className="card hero-card border-0 mb-4">
              <div className="card-body p-4 p-lg-5 d-flex flex-column flex-md-row align-items-stretch gap-4">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="hero-pill-label">
                      <i className="fa-solid fa-fire me-1"></i>
                      Theme
                    </span>
                    <span className="hero-pill-sub">Hosting Vibe</span>
                  </div>
                  <h2 className="hero-title mb-3">
                    Pick your theme&apos;s personality
                  </h2>
                  <p className="text-light-emphasis small mb-3">
                    Choose a theme to set the mood. Colors and motifs will
                    follow your lead.
                  </p>

                  <div className="theme-select-wrapper d-flex align-items-center gap-2">
                    <div className="theme-icon-badge">
                      <i className="fa-solid fa-masks-theater"></i>
                    </div>
                    <div className="styled-select-wrapper flex-grow-1">
                      <select
                        className="form-select form-select-lg theme-select styled-select"
                        value={selectedTheme}
                        onChange={(e) => setSelectedTheme(e.target.value)}
                      >
                        {THEMES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Small simplified illustration */}
                <div className="hero-illustration position-relative">
                  <div className="blob blob-one"></div>
                  <div className="blob blob-two"></div>
                  <div className="hero-grill-card text-center">
                    <i
                      className={`fa-solid ${activeTheme.icon} fa-xl mb-2`}
                    ></i>
                    <p className="small mb-0">{activeTheme.title}</p>
                    <span className="badge bg-dark-subtle text-dark-emphasis rounded-pill mt-1">
                      {activeTheme.tagline}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhancement + Smart Defaults */}
            <div className="row g-3 mb-4">
              <div className="col-md-7">
                <div className="card glass-card border-0 h-100">
                  <div className="card-body p-3 p-lg-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="text-uppercase text-info small mb-0">
                        Choose Type
                      </h6>
                      <i className="fa-regular fa-face-grin-stars text-glow text-info"></i>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {enhancementLevels.map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          className={`enhancement-chip ${
                            enhancement === lvl.id ? "active" : ""
                          }`}
                          onClick={() => setEnhancement(lvl.id)}
                        >
                          <span className="chip-glow"></span>
                          <i className={`fa-solid ${lvl.icon} me-1`}></i>
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-muted small mb-0 mt-3">
                      The option choosen among three will be used to create
                      images based on selected design
                    </p>
                  </div>
                </div>
              </div>

              <div className="col-md-5">
                <div className="card smart-default-card border-0 h-100">
                  <div className="card-body p-3 p-lg-4 position-relative">
                    <div className="d-flex align-items-start gap-2 mb-2">
                      <span className="badge rounded-pill bg-amber-soft text-dark d-flex align-items-center gap-1">
                        <i className="fa-solid fa-circle-info"></i>
                        Smart Defaults
                      </span>
                    </div>
                    <p className="small text-dark mb-2">
                      Leave any picker on <strong>Default</strong> to let the
                      system explore the best combos.
                    </p>
                    <p className="small text-dark-emphasis mb-0">
                      <strong>Three</strong> Best Combos are selected from the
                      default option with selected options
                    </p>
                    <div className="smart-default-shine"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attribute controls */}
            <div className="row g-3 mb-4">
              <div className="col-sm-6">
                <AttributeCard
                  label="Color Palette"
                  icon="fa-palette"
                  value={selections.color_palette}
                  options={
                    catalog.color_palette.length
                      ? catalog.color_palette
                      : ["Default"]
                  }
                  onChange={selectionHandlers.color_palette}
                  grad="grad-1"
                />
              </div>
              <div className="col-sm-6">
                <AttributeCard
                  label="Pattern"
                  icon="fa-grip-lines"
                  value={selections.pattern}
                  options={
                    catalog.pattern.length ? catalog.pattern : ["Default"]
                  }
                  onChange={selectionHandlers.pattern}
                  grad="grad-2"
                />
              </div>
              <div className="col-sm-6">
                <AttributeCard
                  label="Motif"
                  icon="fa-star"
                  value={selections.motif}
                  options={catalog.motif.length ? catalog.motif : ["Default"]}
                  onChange={selectionHandlers.motif}
                  grad="grad-3"
                />
              </div>
              <div className="col-sm-6">
                <AttributeCard
                  label="Style"
                  icon="fa-brush"
                  value={selections.style}
                  options={catalog.style.length ? catalog.style : ["Default"]}
                  onChange={selectionHandlers.style}
                  grad="grad-4"
                />
              </div>
              <div className="col-sm-6">
                <AttributeCard
                  label="Finish"
                  icon="fa-spray-can-sparkles"
                  value={selections.finish}
                  options={catalog.finish.length ? catalog.finish : ["Default"]}
                  onChange={selectionHandlers.finish}
                  grad="grad-5"
                />
              </div>
            </div>

            {/* Extra Detail */}
            {/* <div className="card glass-card border-0 mb-4 grad-6">
              <div className="card-body p-3 p-lg-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <h6 className="text-uppercase text-dark text-glow small mb-0">
                    Extra Detail (Optional)
                  </h6>
                  <i className="fa-regular fa-pen-to-square text-glow text-dark"></i>
                </div>
                <div className="watercolor-box p-2 p-md-3 rounded-4">
                  <textarea
                    className="form-control extra-detail-textarea border-0 shadow-none"
                    rows="3"
                    value={extraDetail}
                    onChange={(e) => setExtraDetail(e.target.value)}
                    placeholder="Add art direction cues: soft gold shimmer, hand-lettered typography, smoky gradients..."
                  />
                </div>
              </div>
            </div> */}

            {/* Buttons */}
            <div className="d-flex flex-wrap gap-3 justify-content-between align-items-center mb-1 mt-4">
              <button
                type="button"
                className="btn btn-outline-light btn-chunky"
                onClick={() => {
                  navigate("/gallery?previous-images");
                }}
              >
                <i className="fa-solid fa-images me-2"></i>
                Previous Images
              </button>
              <div className="d-flex gap-2 flex-row">
                {imageSets.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-light btn-chunky"
                    onClick={() => navigate("/gallery?generated-images")}
                  >
                    <i class="fa-solid fa-photo-film me-2"></i> View results in
                    Gallery
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-chunky-primary"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <span className="btn-glow-layer"></span>
                  <i className="fa-solid fa-wand-magic-sparkles me-2"></i>
                  {loading ? "Generating..." : "Generate Concepts"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function AttributeCard({ label, icon, value, options, onChange, grad }) {
  const [open, setOpen] = useState(false);

  const toTitleCase = (str) => {
    return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className={`card attribute-card border ${grad}`}>
      <div className="card-body p-3 p-lg-4">
        <h6 className="text-uppercase text-dark small mb-2">{label}</h6>
        <div className="fancy-select-wrapper">
          <div className="d-flex flex-row gap-2 align-items-center">
            <div
              className="rounded-circle d-flex justify-content-center align-items-center"
              style={{
                width: "40px",
                height: "40px",
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
            >
              <i className={`fa-solid ${icon} flex-shrink-0`}></i>
            </div>
            <div
              className="fancy-select-display flex-grow-1"
              onClick={() => setOpen(!open)}
            >
              <span className="fancy-select-label">
                <i
                  className={`fa-solid ${ICON_DICTIONARY[value]} fa-sm me-2`}
                ></i>
                {toTitleCase(value)}
              </span>
              <i
                className={`fa-solid fa-chevron-down fancy-caret ${
                  open ? "open" : ""
                }`}
              />
            </div>
          </div>

          {open && (
            <div className="option-chip-grid option-chip-grid-appear">
              <button
                key="default"
                type="button"
                className={`option-chip ${value === "Default" ? "active" : ""}`}
                onClick={() => {
                  onChange("Default");
                  setOpen(false);
                }}
              >
                <i
                  className={`fa-regular ${ICON_DICTIONARY["Default"]} fa-sm me-2`}
                ></i>
                Default
              </button>
              {options.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`option-chip ${o === value ? "active" : ""}`}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  <i
                    className={`fa-solid ${ICON_DICTIONARY[o]} fa-sm me-2`}
                  ></i>
                  {toTitleCase(o)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Selections;
