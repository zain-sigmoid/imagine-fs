import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Head from "./components/Head";
// import { EditPanel } from "../../components/Sidebar";
import { userContext } from "../../context/userContext";
import Results from "./components/Results";
import EditPanel from "./components/EditPanel";
import Sidebar from "./components/Sidebar";
import Previous from "./components/Previous";
import Related from "./components/Related";
import Modal from "../../components/modals/Modal";
import Spinner from "../../components/Spinner";
import "./styling/gallery.css";

const Gallery = (props) => {
  const { showToast, showAlert } = props.prop;
  const [activeTab, setActiveTab] = useState("generated-images");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [hasRecent, setHasRecent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
    );
  }, []);

  const {
    imageSets,
    setImageSets,
    activeVariant,
    selectedComboIndex,
    setSelectedComboIndex,
    setActiveVariant,
    recentImages,
    setRecentImages,
    relatedImages,
    setRelatedImages,
    relatedTotal,
    setRelatedTotal,
    removeImage,
    requestImageEdit,
    editPrompt,
    setEditPrompt,
    loadRelatedImages,
    loadRecentImages,
    recentTotal,
    setRecentTotal,
    downloadImage,
    removeAll,
  } = useContext(userContext);

  const [relatedPage, setRelatedPage] = useState(0);
  const [hasMoreRelated, setHasMoreRelated] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const lastRelatedKey = useRef(null);
  const PAGE_SIZE = 6;
  const [recentPage, setRecentPage] = useState(0);
  const [hasMoreRecent, setHasMoreRecent] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentFetched, setRecentFetched] = useState(false);
  const recentRef = useRef({ items: recentImages, total: recentTotal });
  const editPromptRef = useRef("");

  const handleNewGen = () => {
    setImageSets([]);
    setRelatedImages([]);
    setSelectedComboIndex(0);
    setActiveVariant({});
    setRelatedTotal([]);
    setEditPrompt("");
    setActiveTab("generated-images");
    lastRelatedKey.current = null;
    navigate("/studio");
  };

  const loading = false;
  const handleUseImage = async (image) => {
    try {
      setImageSets([image] || []);
      setSelectedComboIndex(0);
      setActiveVariant({});
      setEditPrompt("");
      setActiveTab("generated-images");
    } catch (error) {
      // silent for now
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      // 1. Deleting on server
      await removeImage(imageId);

      // 2. Checking where this image exists *before* we mutate the arrays
      const wasInRecent = recentImages?.some((img) => img.id === imageId);
      const wasInRelated = relatedImages?.some((img) => img.id === imageId);

      // 3. Removing from both lists (safe even if it's not there)
      setRecentImages((prev) => prev.filter((img) => img.id !== imageId));
      setRelatedImages((prev) => prev.filter((img) => img.id !== imageId));

      // 4. Adjusting counts based on where it actually existed
      if (wasInRecent) {
        setRecentTotal((prev) => Math.max(0, prev - 1));
      }

      if (wasInRelated) {
        setRelatedTotal((prev) => Math.max(0, prev - 1));
      }
      showToast("Image Deleted successfully");
    } catch (error) {
      showAlert("Unable to Delete Image", "danger");
      console.log(error);
      // ignore
    }
  };

  const handleVariantChange = (comboIndex, variantKey) => {
    setActiveVariant((prev) => ({ ...prev, [comboIndex]: variantKey }));
  };

  const handleEditSubmit = async () => {
    setLoadingEdit(true);
    const current = imageSets[selectedComboIndex];
    console.log("edit current", current);
    if (!current) return;
    const baseVariant =
      activeVariant[selectedComboIndex] ??
      current?.selectedVariant ??
      "original";
    const imageID = current?.id;
    const payload = {
      imageId: imageID,
      theme: current?.theme || "no theme",
      variant: baseVariant,
      prompt: editPrompt,
      combo: current?.combo,
      type: current?.type,
    };

    try {
      const editResp = await requestImageEdit(payload);
      if (!editResp || !editResp.variants) return;

      const editedVariant = editResp.variants.edited;
      setImageSets((prev) =>
        prev.map((item, idx) =>
          idx === selectedComboIndex
            ? {
                ...item,
                variants: {
                  ...item.variants, // keeping original variants
                  edited: editedVariant, // inject edited
                },
              }
            : item
        )
      );
      setActiveVariant((prev) => ({
        ...prev,
        [selectedComboIndex]: "edited",
      }));
      showToast("Image Edited Successfully");
      setEditPrompt("");
    } catch (error) {
      showAlert("Unable to edit at present time, try again", "danger");
      console.error(error);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleDownload = async (id, displayVariant = "org") => {
    try {
      await downloadImage(id, displayVariant);
    } catch (error) {
      console.error("download failed");
    }
  };

  const goToPage = useCallback(
    async ({
      page,
      items,
      total,
      loading,
      setLoading,
      setPage,
      setHasMore,
      loadPage,
    }) => {
      if (total === 0 && items.length === 0) {
        setPage(page);
        setHasMore(false);
        return;
      }
      const offset = page * PAGE_SIZE;
      const alreadyLoaded = items.length >= offset + PAGE_SIZE;
      if (alreadyLoaded) {
        setPage(page);
        const effectiveTotal = total || items.length;
        setHasMore((page + 1) * PAGE_SIZE < effectiveTotal);
        return;
      }
      if (loading) return;
      setLoading(true);
      try {
        const data = await loadPage(offset, PAGE_SIZE);
        setHasMore(Boolean(data.has_more));
        setPage(page);
      } catch (error) {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [PAGE_SIZE]
  );

  useEffect(() => {
    recentRef.current = { items: recentImages, total: recentTotal };
  }, [recentImages, recentTotal]);

  const loadRelated = useCallback(
    async (page = 0) => {
      if (activeTab !== "related-images") return;
      const current = imageSets[selectedComboIndex];
      console.log("current in gallery", current);

      if (!current?.combo || !current?.theme) return;
      await goToPage({
        page,
        items: relatedImages,
        total: relatedTotal,
        loading: loadingRelated,
        setLoading: setLoadingRelated,
        setPage: setRelatedPage,
        setHasMore: setHasMoreRelated,
        loadPage: (offset, limit) =>
          loadRelatedImages(
            {
              id: current?.id,
              theme: current.theme,
              type: current.type || current.enhancement,
              selections: current.combo,
            },
            { offset, limit, append: true }
          ),
      });
    },
    [
      activeTab,
      goToPage,
      loadRelatedImages,
      imageSets,
      selectedComboIndex,
      loadingRelated,
      relatedImages,
      relatedTotal,
    ]
  );

  const loadRecent = useCallback(
    async (page = 0) => {
      await goToPage({
        page,
        items: recentRef.current.items,
        total: recentRef.current.total,
        loading: loadingRecent,
        setLoading: setLoadingRecent,
        setPage: setRecentPage,
        setHasMore: setHasMoreRecent,
        loadPage: (offset, limit) =>
          loadRecentImages({ offset, limit, append: true }),
      });
      setRecentFetched(true);
    },
    [goToPage, loadingRecent, loadRecentImages]
  );

  useEffect(() => {
    if (activeTab !== "related-images") return;
    const current = imageSets[selectedComboIndex];
    const comboKey = current
      ? JSON.stringify({ theme: current.theme, combo: current.combo })
      : null;
    if (!comboKey) return;
    const comboChanged = comboKey !== lastRelatedKey.current;
    if (!comboChanged) return;

    console.log("running useeffect 4 on 281");

    // If we already have related images (prefetched), keep them and just align keys.
    if (relatedImages.length > 0) {
      lastRelatedKey.current = comboKey;
      setRelatedPage(0);
      setHasMoreRelated(
        relatedImages.length < (relatedTotal || relatedImages.length)
      );
      return;
    }

    lastRelatedKey.current = comboKey;
    setRelatedImages([]);
    setRelatedTotal(0);
    setHasMoreRelated(true);
    setRelatedPage(0);
    loadRelated(0);
  }, [
    activeTab,
    selectedComboIndex,
    imageSets,
    loadRelated,
    relatedImages.length,
    relatedTotal,
  ]);

  useEffect(() => {
    if (activeTab !== "previous-images") return;
    const { items, total } = recentRef.current;
    if (items.length === 0 && !loadingRecent) {
      if (recentFetched) {
        setHasMoreRecent(false);
        return;
      }
      loadRecent(0);
      return;
    }
    setHasMoreRecent(items.length < total);
  }, [activeTab, loadRecent, loadingRecent, recentFetched]);

  return (
    <div className="app-shell">
      <Modal deleteAll={removeAll} alert={showAlert} />
      <Head />
      <main>
        <div className="row g-4">
          <div className="col-lg-3">
            <Sidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              loadingRecent={loadingRecent}
              loadingRelated={loadingRelated}
            />
          </div>
          <div className="col-lg-9">
            <div className="container ps-4 pe-5 pt-4 pb-3">
              <div className="d-flex justify-content-between align-items-center mb-4 border-2 border-bottom border-primary pb-2">
                <span className="h3 fw-bold text-primary">Gallery</span>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={handleNewGen}
                  >
                    <i className="fa-solid fa-arrows-rotate me-2"></i>
                    New Generation
                  </button>
                  {activeTab == "previous-images" && (
                    <div className="dropdown">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        data-bs-toggle="dropdown"
                        aria-expanded="false"
                      >
                        <i className="fa-solid fa-gear fa-sm"></i>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        <li style={{ fontSize: "14px" }}>
                          <button
                            className={`dropdown-item ${
                              recentTotal == 0 ? "text-muted" : "text-danger"
                            }`}
                            type="button"
                            data-bs-toggle="modal"
                            data-bs-target="#exampleModal"
                            disabled={recentTotal == 0}
                          >
                            <i className="fa-solid fa-trash me-2"></i>
                            Delete All Images
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              {activeTab === "generated-images" && (
                <div className="row g-3">
                  <div className="col-md-8">
                    <Results
                      imageSets={imageSets}
                      selectedComboIndex={selectedComboIndex}
                      onSelectedComboChange={setSelectedComboIndex}
                      activeVariant={activeVariant}
                      onVariantChange={handleVariantChange}
                      loading={loading}
                      downloadImage={handleDownload}
                      editPrompt={editPromptRef.current}
                    />
                  </div>
                  <div className="col-md-4">
                    <EditPanel
                      imageSets={imageSets}
                      selectedComboIndex={selectedComboIndex}
                      onComboChange={setSelectedComboIndex}
                      editPrompt={editPrompt}
                      onEditPromptChange={setEditPrompt}
                      onEditSubmit={handleEditSubmit}
                      activeVariant={activeVariant}
                      onVariantChange={handleVariantChange}
                      loading={loadingEdit}
                      editRef={editPromptRef}
                    />
                  </div>
                </div>
              )}
              {activeTab === "previous-images" && (
                <>
                  {(() => {
                    const start = recentPage * PAGE_SIZE;
                    const pageItems = recentImages.slice(
                      start,
                      start + PAGE_SIZE
                    );
                    return (
                      <Previous
                        items={pageItems}
                        recentImages={recentImages}
                        onUseImage={handleUseImage}
                        onDeleteImage={handleDeleteImage}
                        downloadImage={handleDownload}
                        loading={loadingRecent}
                        setLoading={setLoadingRecent}
                        hasRecent={hasRecent}
                        setHasRecent={setHasRecent}
                      />
                    );
                  })()}
                  <nav
                    aria-label="Recent pagination"
                    className="mt-5 d-flex justify-content-center align-items-center"
                  >
                    <ul className="pagination">
                      <li
                        className={`page-item ${
                          recentPage === 0 ? "disabled" : ""
                        }`}
                      >
                        <button
                          className="page-link"
                          onClick={() =>
                            loadRecent(Math.max(recentPage - 1, 0))
                          }
                          disabled={recentPage === 0 || loadingRecent}
                        >
                          Previous
                        </button>
                      </li>
                      <li className="page-item disabled">
                        <span className="page-link">
                          {loadingRecent ? (
                            <Spinner size="sm" color="primary" />
                          ) : (
                            <>
                              Page {recentPage + 1} of{" "}
                              {Math.max(
                                1,
                                Math.ceil((recentTotal || 0) / PAGE_SIZE)
                              )}
                            </>
                          )}
                        </span>
                      </li>
                      <li
                        className={`page-item ${
                          !hasMoreRecent ? "disabled" : ""
                        }`}
                      >
                        <button
                          className="page-link"
                          onClick={() => loadRecent(recentPage + 1)}
                          disabled={!hasMoreRecent || loadingRecent}
                        >
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                </>
              )}
              {activeTab === "related-images" && (
                <>
                  {(() => {
                    const pageSize = 6;
                    const start = relatedPage * pageSize;
                    const pageItems = relatedImages.slice(
                      start,
                      start + pageSize
                    );
                    return (
                      <Related
                        items={pageItems}
                        onUseImage={handleUseImage}
                        onDeleteImage={handleDeleteImage}
                        downloadImage={handleDownload}
                        loading={loadingRelated}
                      />
                    );
                  })()}
                  <nav
                    aria-label="Related pagination"
                    className="mt-5 d-flex justify-content-center align-items-center"
                  >
                    <ul className="pagination">
                      <li
                        className={`page-item ${
                          relatedPage === 0 ? "disabled" : ""
                        }`}
                      >
                        <button
                          className="page-link"
                          onClick={() =>
                            loadRelated(Math.max(relatedPage - 1, 0))
                          }
                          disabled={relatedPage === 0 || loadingRelated}
                        >
                          Previous
                        </button>
                      </li>
                      <li className="page-item disabled">
                        <span className="page-link">
                          {loadingRelated ? (
                            <Spinner size="sm" color="primary" />
                          ) : (
                            <>
                              Page {relatedPage + 1} of{" "}
                              {Math.max(1, Math.ceil((relatedTotal || 0) / 6))}
                            </>
                          )}
                        </span>
                      </li>
                      <li
                        className={`page-item ${
                          !hasMoreRelated ? "disabled" : ""
                        }`}
                      >
                        <button
                          className="page-link"
                          onClick={() => loadRelated(relatedPage + 1)}
                          disabled={!hasMoreRelated || loadingRelated}
                        >
                          Next{" "}
                        </button>
                      </li>
                    </ul>
                  </nav>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Gallery;
