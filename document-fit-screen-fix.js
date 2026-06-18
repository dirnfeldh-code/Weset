(() => {
  const style = document.createElement("style");
  style.textContent = `
    .send-preview-dialog,
    .doc-edit-dialog {
      height: min(96dvh, calc(100vh - 16px)) !important;
      max-height: min(96dvh, calc(100vh - 16px)) !important;
    }

    .send-preview-card,
    .doc-edit-card {
      height: 100% !important;
      grid-template-rows: auto minmax(0, 1fr) auto !important;
    }

    .send-preview-body,
    .doc-edit-body {
      min-height: 0 !important;
      overflow: auto !important;
    }

    .send-preview-body {
      grid-template-columns: minmax(260px, 0.68fr) minmax(360px, 1fr) !important;
      padding: 12px !important;
    }

    .send-preview-panel {
      min-height: 0 !important;
    }

    .send-preview-email,
    .send-preview-attachment {
      max-height: none !important;
      min-height: 0 !important;
      overflow: auto !important;
      padding: 10px !important;
    }

    .send-preview-email-frame {
      max-width: min(720px, 100%) !important;
      width: 100% !important;
    }

    .send-preview-attachment-frame {
      align-items: flex-start !important;
      background: #eef5f4 !important;
      border: 0 !important;
      box-shadow: none !important;
      display: flex !important;
      justify-content: center !important;
      max-width: 100% !important;
      overflow: visible !important;
      width: 100% !important;
    }

    .send-preview-attachment-frame > div {
      border: 1px solid #d9e0e1 !important;
      box-shadow: 0 8px 22px rgba(18, 35, 39, 0.08) !important;
      flex: 0 0 auto !important;
      max-width: 900px !important;
      transform-origin: top center !important;
      width: min(900px, 100%) !important;
    }

    @media (max-width: 1180px) and (min-width: 761px) {
      .send-preview-body {
        grid-template-columns: 300px minmax(0, 1fr) !important;
      }
      .send-preview-attachment-frame > div {
        transform: scale(0.82) !important;
        width: 900px !important;
        margin-bottom: -110px !important;
      }
      .send-preview-email-frame {
        transform: scale(0.92) !important;
        transform-origin: top center !important;
        margin-bottom: -24px !important;
      }
    }

    @media (max-width: 980px) and (min-width: 761px) {
      .send-preview-body {
        grid-template-columns: 260px minmax(0, 1fr) !important;
      }
      .send-preview-attachment-frame > div {
        transform: scale(0.70) !important;
        margin-bottom: -170px !important;
      }
      .send-preview-email-frame {
        transform: scale(0.86) !important;
        margin-bottom: -44px !important;
      }
    }

    @media (min-width: 1280px) {
      .send-preview-dialog {
        max-width: min(1240px, calc(100vw - 20px)) !important;
        width: min(1240px, calc(100vw - 20px)) !important;
      }
      .send-preview-body {
        grid-template-columns: 330px minmax(0, 1fr) !important;
      }
    }

    @media (max-width: 760px) {
      .send-preview-dialog,
      .doc-edit-dialog {
        height: 100dvh !important;
        max-height: 100dvh !important;
      }
      .send-preview-body {
        grid-template-columns: 1fr !important;
      }
      .send-preview-attachment-frame {
        justify-content: flex-start !important;
        overflow-x: auto !important;
      }
      .send-preview-attachment-frame > div {
        min-width: 780px !important;
        transform: scale(0.74) !important;
        transform-origin: top left !important;
        margin-bottom: -170px !important;
      }
      .send-preview-email-frame {
        max-width: 100% !important;
        transform: none !important;
      }
    }

    @media (max-height: 760px) and (min-width: 761px) {
      .send-preview-head,
      .send-preview-actions,
      .doc-edit-head,
      .doc-edit-actions {
        padding: 10px 14px !important;
      }
      .send-preview-body {
        gap: 10px !important;
        max-height: calc(96dvh - 106px) !important;
      }
      .send-preview-attachment-frame > div {
        transform: scale(0.66) !important;
        margin-bottom: -210px !important;
      }
      .send-preview-email-frame {
        transform: scale(0.82) !important;
        margin-bottom: -58px !important;
      }
    }
  `;
  document.head.appendChild(style);
})();
