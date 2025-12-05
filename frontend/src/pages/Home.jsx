import { useEffect, useMemo, useState } from "react";
import "../App.css";
import PromptBuilder from "../components/PromptBuilder";
import ResultsGallery from "../components/ResultsGallery";
import Sidebar from "../components/Sidebar";
import {
  fetchDesignOptions,
  fetchRecentImages,
  generateDesigns,
  loadImageMetadata,
  removeImage,
  requestImageEdit,
} from "../services/api";

const STREAMLIT_THEMES = [
  "🍔 Backyard BBQs / Cookouts",
  "🏊‍♂️ Pool parties",
  "🐣 Easter brunches",
  "🎃 Halloween parties",
  "🎉 New Year’s brunch",
  "💼 Farewell or promotion parties at work",
];

const DEFAULT_SELECTIONS = {
  color_palette: "Default",
  pattern: "Default",
  motif: "Default",
  style: "Default",
  finish: "Default",
};

const Home = (props) => {
  const { showAlert } = props.prop;
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({
    color_palette: [],
    pattern: [],
    motif: [],
    style: [],
    finish: [],
  });
  const [theme, setTheme] = useState(STREAMLIT_THEMES.at(0) ?? "");
  const [enhancement, setEnhancement] = useState("Low");
  const [extraDetail, setExtraDetail] = useState("");
  const [selections, setSelections] = useState(DEFAULT_SELECTIONS);
  const [imageSets, setImageSets] = useState([]);
  const [recentImages, setRecentImages] = useState([]);
  const [selectedComboIndex, setSelectedComboIndex] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [activeVariant, setActiveVariant] = useState({});

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

  const bootstrapSelections = (incoming) => ({
    ...DEFAULT_SELECTIONS,
    ...(incoming ?? {}),
  });

  useEffect(() => {
    const initialise = async () => {
      try {
        const resolvedOptions = await fetchDesignOptions();
        setOptions(resolvedOptions);
      } catch (error) {
        console.error("Failed to fetch options", error);
        showAlert(
          "Could not load design options. Using Streamlit defaults.",
          "danger"
        );
      }

      //   try {
      //     const images = await fetchRecentImages();
      //     setRecentImages(images);
      //   } catch (error) {
      //     console.warn("Failed to fetch recent images", error);
      //   }
    };

    initialise();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateDesigns({
        theme,
        enhancement,
        extraDetail,
        selections,
        catalog,
      });
      setImageSets(result.image_sets ?? []);
      setSelectedComboIndex(0);
      setActiveVariant({});
      if (result.message) {
        showAlert(result.message, "info");
      } else {
        showAlert("Design generation complete.", "success");
      }
      if (result.recent_images) {
        setRecentImages(result.recent_images);
      }
    } catch (error) {
      console.error("Generation failed", error);
      showAlert(
        error?.message ?? "Unable to generate designs. Please try again.",
        "danger"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUseRecent = async (imageId) => {
    setLoading(true);
    try {
      const data = await loadImageMetadata(imageId);
      setImageSets(data.image_sets ?? []);
      setSelections(bootstrapSelections(data.selections));
      setEnhancement(data.enhancement ?? "Low");
      setExtraDetail(data.extra_detail ?? "");
      setSelectedComboIndex(0);
      setActiveVariant({});
      showAlert("Loaded previous image set.", "success");
    } catch (error) {
      console.error("Unable to load previous image", error);
      showAlert(
        "Could not load the requested design. Please try another image.",
        "danger"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await removeImage(imageId);
      setRecentImages((prev) => prev.filter((img) => img.id !== imageId));
      showAlert("Image deleted.", "info");
    } catch (error) {
      console.error("Deletion failed", error);
      showAlert("Unable to delete that image right now.", "danger");
    }
  };

  const handleEditSubmit = async () => {
    if (!imageSets.length) {
      showAlert("Generate or load an image before editing.", "danger");
      return;
    }

    if (!editPrompt.trim()) {
      showAlert("Write a short prompt describing the edit.", "danger");
      return;
    }

    const current = imageSets[selectedComboIndex];
    const baseVariant =
      activeVariant[selectedComboIndex] ??
      current?.selectedVariant ??
      "original";

    setLoading(true);
    try {
      const response = await requestImageEdit({
        comboIndex: selectedComboIndex,
        baseVariant,
        prompt: editPrompt,
        savedPath: current?.saved_path,
      });

      setImageSets((prev) =>
        prev.map((item, idx) =>
          idx === selectedComboIndex
            ? { ...item, edited: response.edited }
            : item
        )
      );
      setEditPrompt("");
      showAlert(response.message ?? "Edit applied successfully.", "success");
    } catch (error) {
      console.error("Edit failed", error);
      showAlert(
        error?.message ?? "Unable to edit this image right now.",
        "danger"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVariantChange = (comboIndex, variantKey) => {
    setActiveVariant((prev) => ({ ...prev, [comboIndex]: variantKey }));
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container p-4">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h1 className="display-6 fw-semibold mb-2 text-dark">
                Imagine: Premium Napkin Generator
              </h1>
              <p className="lead text-muted">
                Craft themed serviettes with curated palettes, motifs, and
                finishes. Fine-tune details, compare enhancements, and export in
                a click.
              </p>
            </div>
            <div className="col-md-4 text-md-end">
              <div className="row">
                <div className="col d-flex flex-column justify-content-center align-items-center gap-5">
                  <span className="shadow rounded p-3">
                    <i className="fa-solid fa-wand-magic-sparkles fa-xl text-primary"></i>
                  </span>
                  <span>
                    <img
                      src={
                        new URL("../assets/gemini.png", import.meta.url).href
                      }
                      alt="Gemini icon"
                      className="shadow rounded p-2"
                      height={60}
                      width={60}
                    />
                  </span>
                </div>
                <div className="col d-flex flex-column justify-content-center align-items-start">
                  <span className="shadow rounded p-3">
                    <i className="fa-solid fa-image fa-2xl text-danger"></i>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container-xxl my-4">
        <div className="row g-4">
          <div className="col-lg-8">
            <PromptBuilder
              themes={STREAMLIT_THEMES}
              theme={theme}
              onThemeChange={setTheme}
              enhancement={enhancement}
              onEnhancementChange={setEnhancement}
              catalog={catalog}
              selections={selections}
              onSelectionsChange={setSelections}
              extraDetail={extraDetail}
              onExtraDetailChange={setExtraDetail}
              onSubmit={handleGenerate}
              loading={loading}
            />

            <ResultsGallery
              imageSets={imageSets}
              selectedComboIndex={selectedComboIndex}
              onSelectedComboChange={setSelectedComboIndex}
              activeVariant={activeVariant}
              onVariantChange={handleVariantChange}
              loading={loading}
            />
          </div>

          <div className="col-lg-4">
            <Sidebar
              recentImages={recentImages}
              onUseImage={handleUseRecent}
              onDeleteImage={handleDeleteImage}
              imageSets={imageSets}
              selectedComboIndex={selectedComboIndex}
              onComboChange={setSelectedComboIndex}
              editPrompt={editPrompt}
              onEditPromptChange={setEditPrompt}
              onEditSubmit={handleEditSubmit}
              activeVariant={activeVariant}
              onVariantChange={handleVariantChange}
              loading={loading}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
