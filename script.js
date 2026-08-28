/* public/script.js
   AFCA / IVS Admission Form
   Signature Pad + Student Summary + PDF Export + WhatsApp Share

   FRONTEND-ONLY VERSION

   IMPORTANT:
   - No admission data is sent to any API.
   - No admission data is stored in any database.
   - Data exists only in the browser while the form is open.
   - Clicking Save creates the PDF only.
*/

document.addEventListener("DOMContentLoaded", () => {
  initSignaturePad();
  wireButtons();
  autoFillCurrentSession();
  initSingleGradeSelect();
  autoFillRegDate();
  initDeclarationMaster();
  initGuardianWhatsAppDropdown();
});

/* =========================================================
   SESSION
========================================================= */

function getCurrentAcademicSession() {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const start = String(currentYear);
  const end = String(nextYear).slice(-2);

  return `${start}-${end}`;
}

function autoFillCurrentSession() {
  const sessionValue = getCurrentAcademicSession();

  const sessionText = document.getElementById("sessionText");

  if (sessionText) {
    sessionText.textContent = sessionValue;
  }

  const sessionInput = document.getElementById("session");

  if (sessionInput) {
    sessionInput.value = sessionValue;
  }
}

/* =========================================================
   REGISTRATION DATE
========================================================= */

function autoFillRegDate() {
  const container = document.getElementById("regBoxes");

  if (!container) return;

  const boxes = Array.from(
    container.querySelectorAll(".box")
  );

  if (!boxes.length) return;

  // Do not overwrite a date already entered.
  const anyFilled = boxes.some(
    (box) => (box.value || "").trim() !== ""
  );

  if (anyFilled) return;

  const now = new Date();

  const mm = String(now.getMonth() + 1).padStart(
    2,
    "0"
  );

  const dd = String(now.getDate()).padStart(
    2,
    "0"
  );

  const yyyy = String(now.getFullYear());

  // MMDDYYYY
  const sequence = (
    mm +
    dd +
    yyyy
  ).split("");

  boxes.forEach((box, index) => {
    if (index < sequence.length) {
      box.value = sequence[index];
    }
  });

  const hiddenDate =
    document.getElementById("regDate");

  if (hiddenDate) {
    hiddenDate.value =
      `${yyyy}-${mm}-${dd}`;
  }
}

/* =========================================================
   SIGNATURE PAD
========================================================= */

let sigCanvas;
let sigCtx;

let isDrawing = false;
let lastPoint = null;

/*
  Prevent multiple clicks while the PDF
  is being generated.
*/
let isSubmittingAdmission = false;

function initSignaturePad() {
  sigCanvas =
    document.getElementById("sig");

  if (!sigCanvas) return;

  sigCtx =
    sigCanvas.getContext("2d");

  sigCtx.lineWidth = 2;
  sigCtx.lineCap = "round";
  sigCtx.strokeStyle = "#0f172a";

  const getPosition = (event) => {
    const pointer =
      event.touches
        ? event.touches[0]
        : event;

    const rectangle =
      sigCanvas.getBoundingClientRect();

    return {
      x:
        (pointer.clientX - rectangle.left) *
        (sigCanvas.width / rectangle.width),

      y:
        (pointer.clientY - rectangle.top) *
        (sigCanvas.height / rectangle.height),
    };
  };

  const startDrawing = (event) => {
    isDrawing = true;

    lastPoint =
      getPosition(event);

    event.preventDefault();
  };

  const draw = (event) => {
    if (!isDrawing) return;

    const point =
      getPosition(event);

    sigCtx.beginPath();

    sigCtx.moveTo(
      lastPoint.x,
      lastPoint.y
    );

    sigCtx.lineTo(
      point.x,
      point.y
    );

    sigCtx.stroke();

    lastPoint = point;

    event.preventDefault();
  };

  const stopDrawing = () => {
    isDrawing = false;
    lastPoint = null;
  };

  // Mouse
  sigCanvas.addEventListener(
    "mousedown",
    startDrawing
  );

  sigCanvas.addEventListener(
    "mousemove",
    draw
  );

  document.addEventListener(
    "mouseup",
    stopDrawing
  );

  // Touch
  sigCanvas.addEventListener(
    "touchstart",
    startDrawing,
    {
      passive: false,
    }
  );

  sigCanvas.addEventListener(
    "touchmove",
    draw,
    {
      passive: false,
    }
  );

  sigCanvas.addEventListener(
    "touchend",
    stopDrawing
  );

  // Clear Signature
  const clearButton =
    document.getElementById("clearSig");

  if (clearButton) {
    clearButton.addEventListener(
      "click",
      () => {
        sigCtx.clearRect(
          0,
          0,
          sigCanvas.width,
          sigCanvas.height
        );
      }
    );
  }
}

/* =========================================================
   SIGNATURE DATA
========================================================= */

function getSignatureDataURL() {
  if (!sigCanvas) return "";

  const blankCanvas =
    document.createElement("canvas");

  blankCanvas.width =
    sigCanvas.width;

  blankCanvas.height =
    sigCanvas.height;

  if (
    sigCanvas.toDataURL() ===
    blankCanvas.toDataURL()
  ) {
    return "";
  }

  return sigCanvas.toDataURL(
    "image/png"
  );
}

/* =========================================================
   PDF BUTTON
========================================================= */

function wireButtons() {
  const pdfButton =
    document.getElementById("btnPdf");

  if (!pdfButton) return;

  pdfButton.addEventListener(
    "click",
    exportPdfAndOpenWhatsAppApp
  );
}

function setPdfButtonBusyState(isBusy) {
  const button =
    document.getElementById("btnPdf");

  if (!button) return;

  if (isBusy) {
    button.disabled = true;

    button.setAttribute(
      "aria-disabled",
      "true"
    );

    button.style.pointerEvents =
      "none";

    button.style.opacity =
      "0.6";

    button.dataset.originalText =
      button.textContent;

    button.textContent =
      "Creating PDF...";

    return;
  }

  button.disabled = false;

  const master =
    document.getElementById(
      "declMaster"
    );

  if (
    master &&
    !master.checked
  ) {
    button.setAttribute(
      "aria-disabled",
      "true"
    );

    button.style.pointerEvents =
      "none";

    button.style.opacity =
      "0.5";
  } else {
    button.removeAttribute(
      "aria-disabled"
    );

    button.style.pointerEvents =
      "auto";

    button.style.opacity =
      "1";
  }

  if (
    button.dataset.originalText
  ) {
    button.textContent =
      button.dataset.originalText;
  } else {
    button.textContent =
      "Save Filled Form as PDF";
  }
}

/* =========================================================
   CREATE PDF
========================================================= */

async function buildPdfFromPages() {
  if (
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {
    throw new Error(
      "jsPDF library is not loaded."
    );
  }

  if (
    typeof html2canvas ===
    "undefined"
  ) {
    throw new Error(
      "html2canvas library is not loaded."
    );
  }

  const { jsPDF } =
    window.jspdf;

  /*
    Make sure frontend student summary
    contains the latest values before the
    HTML is captured.
  */
  if (
    typeof window.generateSummaryHTML ===
    "function"
  ) {
    window.generateSummaryHTML();
  }

  const pages =
    Array.from(
      document.querySelectorAll(
        ".page"
      )
    );

  if (!pages.length) {
    alert(
      "No printable form pages were found."
    );

    return null;
  }

  /*
    Hide non-PDF interface elements.
  */
  document.body.classList.add(
    "pdf-export"
  );

  const infoBar =
    document.querySelector(
      ".info-bar"
    );

  let previousInfoBarDisplay = "";

  if (infoBar) {
    previousInfoBarDisplay =
      infoBar.style.display;

    infoBar.style.display =
      "none";
  }

  try {
    /*
      Wait for logos/images before
      capturing the pages.
    */
    await Promise.all(
      Array.from(
        document.images
      ).map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }

        return new Promise(
          (resolve) => {
            image.onload =
              resolve;

            image.onerror =
              resolve;
          }
        );
      })
    );

    const pdf =
      new jsPDF(
        "p",
        "pt",
        "a4"
      );

    for (
      let index = 0;
      index < pages.length;
      index++
    ) {
      const page =
        pages[index];

      const canvas =
        await html2canvas(
          page,
          {
            scale: 2.2,

            useCORS: true,

            allowTaint: false,

            backgroundColor:
              "#ffffff",

            logging: false,

            windowWidth: 980,

            scrollX: 0,

            scrollY: 0,
          }
        );

      const image =
        canvas.toDataURL(
          "image/jpeg",
          0.95
        );

      if (index > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        image,
        "JPEG",
        0,
        0,
        595,
        842
      );
    }

    const date =
      new Date()
        .toISOString()
        .slice(0, 10);

    const studentName =
      document
        .getElementById(
          "studentName"
        )
        ?.value
        ?.trim()
        ?.replace(
          /[^a-z0-9]+/gi,
          "-"
        )
        ?.replace(
          /^-+|-+$/g,
          ""
        ) || "Student";

    const filename =
      `AFCA-Admission-${studentName}-${date}.pdf`;

    return {
      pdf,
      filename,
    };
  } finally {
    /*
      Always restore browser UI,
      even if PDF generation fails.
    */
    if (infoBar) {
      infoBar.style.display =
        previousInfoBarDisplay;
    }

    document.body.classList.remove(
      "pdf-export"
    );
  }
}

/* =========================================================
   SAVE PDF

   IMPORTANT:
   There is NO database/API request here.
========================================================= */

async function exportPdfAndOpenWhatsAppApp() {
  if (isSubmittingAdmission) {
    return;
  }

  const master =
    document.getElementById(
      "declMaster"
    );

  if (
    master &&
    !master.checked
  ) {
    alert(
      'Please tick the "I agree" checkbox to proceed.'
    );

    try {
      master.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } catch {}

    return;
  }

  isSubmittingAdmission = true;

  setPdfButtonBusyState(true);

  try {
    /*
      Mark individual declaration
      checkboxes if master agreement
      has been accepted.
    */
    document
      .querySelectorAll(
        ".declaration-list input.decl"
      )
      .forEach(
        (checkbox) => {
          checkbox.checked = true;
        }
      );

    /*
      FRONTEND ONLY.

      No fetch()
      No POST request
      No dashboard API
      No MongoDB
      No PostgreSQL
      No database storage

      Only generate/share/download PDF.
    */
    await exportPdfAndOpenWhatsAppAppInner();
  } catch (error) {
    console.error(
      "PDF generation error:",
      error
    );

    alert(
      "Something went wrong while creating the PDF. Please try again."
    );
  } finally {
    isSubmittingAdmission =
      false;

    setPdfButtonBusyState(
      false
    );
  }
}

/* =========================================================
   PDF DOWNLOAD / NATIVE SHARE
========================================================= */

async function exportPdfAndOpenWhatsAppAppInner() {
  const result =
    await buildPdfFromPages();

  if (!result) return;

  const {
    pdf,
    filename,
  } = result;

  const blob =
    pdf.output("blob");

  const file =
    new File(
      [blob],
      filename,
      {
        type: "application/pdf",
      }
    );

  const student =
    document
      .getElementById(
        "studentName"
      )
      ?.value
      ?.trim() ||
    "student";

  const caption =
    `AFCA Admission Form for ${student}\n` +
    `Session: ${getCurrentAcademicSession()}\n\n` +
    `Please review the attached admission form. Thank you.`;

  /*
    Mobile browsers can attach the PDF
    directly using native Web Share API.
  */
  try {
    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file],
      })
    ) {
      await navigator.share({
        files: [file],

        title:
          "AFCA Admission Form",

        text: caption,
      });

      /*
        Keep a local PDF copy too.
      */
      try {
        pdf.save(filename);
      } catch (
        saveError
      ) {
        console.warn(
          "Local PDF save failed:",
          saveError
        );
      }

      return;
    }
  } catch (shareError) {
    console.warn(
      "Native sharing cancelled or failed:",
      shareError
    );
  }

  /*
    Desktop / unsupported browser:
    simply download the PDF.

    No API call is made.
  */
  try {
    pdf.save(filename);
  } catch (saveError) {
    console.error(
      "PDF download failed:",
      saveError
    );

    throw saveError;
  }
}

/* =========================================================
   SINGLE GRADE SELECTION
========================================================= */

function initSingleGradeSelect() {
  const grid =
    document.querySelector(
      ".grades"
    );

  if (!grid) return;

  const inputs =
    Array.from(
      grid.querySelectorAll(
        'input[type="checkbox"]'
      )
    );

  const initiallyChecked =
    inputs.filter(
      (input) =>
        input.checked
    );

  if (
    initiallyChecked.length >
    1
  ) {
    initiallyChecked
      .slice(1)
      .forEach(
        (input) => {
          input.checked = false;
        }
      );
  }

  inputs.forEach(
    (input) => {
      input.addEventListener(
        "pointerdown",
        () => {
          if (!input.checked) {
            inputs.forEach(
              (otherInput) => {
                if (
                  otherInput !==
                  input
                ) {
                  otherInput.checked =
                    false;
                }
              }
            );
          }
        }
      );

      input.addEventListener(
        "change",
        (event) => {
          if (
            event.target.checked
          ) {
            inputs.forEach(
              (otherInput) => {
                if (
                  otherInput !==
                  event.target
                ) {
                  otherInput.checked =
                    false;
                }
              }
            );
          }
        }
      );
    }
  );
}

/* =========================================================
   DECLARATION MASTER CHECKBOX
========================================================= */

function initDeclarationMaster() {
  const master =
    document.getElementById(
      "declMaster"
    );

  const button =
    document.getElementById(
      "btnPdf"
    );

  if (
    !master ||
    !button
  ) {
    return;
  }

  const updateButtonState =
    () => {
      if (
        master.checked
      ) {
        button.removeAttribute(
          "aria-disabled"
        );

        button.style.pointerEvents =
          "auto";

        button.style.opacity =
          "1";
      } else {
        button.setAttribute(
          "aria-disabled",
          "true"
        );

        button.style.pointerEvents =
          "none";

        button.style.opacity =
          "0.5";
      }
    };

  updateButtonState();

  master.addEventListener(
    "change",
    updateButtonState
  );
}

/* =========================================================
   ADD ANOTHER CHILD
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const addButton =
      document.getElementById(
        "addChildBtn"
      );

    const template =
      document.getElementById(
        "childTemplate"
      );

    const studentContainer =
      document.querySelector(
        "#studentInfoSection .content"
      ) ||
      document.getElementById(
        "studentInfoSection"
      );

    if (
      !addButton ||
      !template ||
      !studentContainer
    ) {
      return;
    }

    let childIndex = 1;

    addButton.addEventListener(
      "click",
      () => {
        childIndex++;

        const clone =
          template.cloneNode(
            true
          );

        clone.style.display =
          "block";

        clone.id = "";

        clone.innerHTML =
          clone.innerHTML.replace(
            /__INDEX__/g,
            childIndex
          );

        studentContainer.appendChild(
          clone
        );

        const removeButton =
          clone.querySelector(
            ".removeChildBtn"
          );

        if (
          removeButton
        ) {
          removeButton.addEventListener(
            "click",
            () => {
              clone.remove();

              if (
                typeof window.generateSummaryHTML ===
                "function"
              ) {
                window.generateSummaryHTML();
              }
            }
          );
        }

        /*
          Add live-summary listeners
          to fields inside new child.
        */
        const fields =
          clone.querySelectorAll(
            "input, select"
          );

        fields.forEach(
          (field) => {
            field.addEventListener(
              "input",
              () => {
                if (
                  typeof window.generateSummaryHTML ===
                  "function"
                ) {
                  window.generateSummaryHTML();
                }
              }
            );

            field.addEventListener(
              "change",
              () => {
                if (
                  typeof window.generateSummaryHTML ===
                  "function"
                ) {
                  window.generateSummaryHTML();
                }
              }
            );
          }
        );

        if (
          typeof window.generateSummaryHTML ===
          "function"
        ) {
          window.generateSummaryHTML();
        }

        try {
          clone.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } catch {}
      }
    );
  }
);

/* =========================================================
   LIVE STUDENT SUMMARY
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const summaryDiv =
      document.getElementById(
        "studentSummary"
      );

    if (!summaryDiv) {
      return;
    }

    const mainName =
      document.getElementById(
        "studentName"
      );

    const mainDob =
      document.getElementById(
        "dob"
      );

    const mainGrade =
      document.getElementById(
        "gradeSelect"
      );

    const mainGenderRadios =
      document.querySelectorAll(
        'input[name="gender"]'
      );

    /*
      Escape user-entered values before
      injecting them into summary HTML.
    */
    const escapeHTML =
      (value) => {
        return String(
          value || ""
        )
          .replace(
            /&/g,
            "&amp;"
          )
          .replace(
            /</g,
            "&lt;"
          )
          .replace(
            />/g,
            "&gt;"
          )
          .replace(
            /"/g,
            "&quot;"
          )
          .replace(
            /'/g,
            "&#039;"
          );
      };

    window.generateSummaryHTML =
      function () {
        let html = "";

        let displayIndex = 1;

        const mainGender =
          Array.from(
            mainGenderRadios
          ).find(
            (radio) =>
              radio.checked
          )?.value || "";

        const nameValue =
          mainName?.value || "";

        const dobValue =
          mainDob?.value || "";

        const gradeValue =
          mainGrade?.value || "";

        /*
          Main student
        */
        if (
          nameValue ||
          dobValue ||
          gradeValue ||
          mainGender
        ) {
          html += `
            <div
              class="child-summary"
              data-index="main"
            >

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                "
              >

                <strong>
                  Child ${displayIndex}:
                </strong>

                <button
                  type="button"
                  class="
                    remove-summary-btn
                    hide-in-pdf
                  "
                  style="
                    background:#dc2626;
                    color:#fff;
                    border:none;
                    padding:2px 6px;
                    border-radius:4px;
                    cursor:pointer;
                    font-size:12px;
                  "
                >
                  ✖
                </button>

              </div>

              Name:
              ${escapeHTML(nameValue)}
              <br>

              DOB:
              ${escapeHTML(dobValue)}
              <br>

              Gender:
              ${escapeHTML(mainGender)}
              <br>

              Grade:
              ${escapeHTML(gradeValue)}

            </div>

            <hr class="sep">
          `;

          displayIndex++;
        }

        /*
          Additional children
        */
        const childBlocks =
          document.querySelectorAll(
            ".child-block"
          );

        childBlocks.forEach(
          (
            block,
            blockIndex
          ) => {
            const childName =
              block.querySelector(
                ".studentName"
              )?.value || "";

            const childDob =
              block.querySelector(
                ".dob"
              )?.value || "";

            const childGrade =
              block.querySelector(
                "select"
              )?.value || "";

            const childGender =
              block.querySelector(
                'input[type="radio"]:checked'
              )?.value || "";

            if (
              childName ||
              childDob ||
              childGrade ||
              childGender
            ) {
              html += `
                <div
                  class="child-summary"
                  data-index="${blockIndex}"
                >

                  <div
                    style="
                      display:flex;
                      justify-content:space-between;
                      align-items:center;
                    "
                  >

                    <strong>
                      Child ${displayIndex}:
                    </strong>

                    <button
                      type="button"
                      class="
                        remove-summary-btn
                        hide-in-pdf
                      "
                      style="
                        background:#dc2626;
                        color:#fff;
                        border:none;
                        padding:2px 6px;
                        border-radius:4px;
                        cursor:pointer;
                        font-size:12px;
                      "
                    >
                      ✖
                    </button>

                  </div>

                  Name:
                  ${escapeHTML(childName)}
                  <br>

                  DOB:
                  ${escapeHTML(childDob)}
                  <br>

                  Gender:
                  ${escapeHTML(childGender)}
                  <br>

                  Grade:
                  ${escapeHTML(childGrade)}

                </div>

                <hr class="sep">
              `;

              displayIndex++;
            }
          }
        );

        summaryDiv.innerHTML =
          html ||
          "<em>No student data yet.</em>";

        /*
          Remove child from summary
        */
        summaryDiv
          .querySelectorAll(
            ".remove-summary-btn"
          )
          .forEach(
            (button) => {
              button.addEventListener(
                "click",
                (event) => {
                  const summary =
                    event.target.closest(
                      ".child-summary"
                    );

                  if (!summary) {
                    return;
                  }

                  const blockIndex =
                    summary.dataset.index;

                  if (
                    blockIndex ===
                    "main"
                  ) {
                    if (
                      mainName
                    ) {
                      mainName.value =
                        "";
                    }

                    if (
                      mainDob
                    ) {
                      mainDob.value =
                        "";
                    }

                    if (
                      mainGrade
                    ) {
                      mainGrade.value =
                        "";
                    }

                    mainGenderRadios.forEach(
                      (radio) => {
                        radio.checked =
                          false;
                      }
                    );
                  } else {
                    const blocks =
                      document.querySelectorAll(
                        ".child-block"
                      );

                    if (
                      blocks[
                        Number(
                          blockIndex
                        )
                      ]
                    ) {
                      blocks[
                        Number(
                          blockIndex
                        )
                      ].remove();
                    }
                  }

                  window.generateSummaryHTML();
                }
              );
            }
          );
      };

    /*
      Watch main student fields.
    */
    [
      mainName,
      mainDob,
      mainGrade,
    ]
      .filter(Boolean)
      .forEach(
        (field) => {
          field.addEventListener(
            "input",
            window.generateSummaryHTML
          );

          field.addEventListener(
            "change",
            window.generateSummaryHTML
          );
        }
      );

    mainGenderRadios.forEach(
      (radio) => {
        radio.addEventListener(
          "change",
          window.generateSummaryHTML
        );
      }
    );

    window.generateSummaryHTML();
  }
);

/* =========================================================
   PROCESSED BY / SENT BY
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const nameBox =
      document.getElementById(
        "processedByName"
      );

    if (!nameBox) {
      return;
    }

    const query =
      new URLSearchParams(
        window.location.search
      );

    let sender =
      (
        query.get(
          "sentBy"
        ) || ""
      ).trim();

    const STAFF_MAP = {
      ms: "Mustafa",
      sz: "Shahzor",
      mt: "Motasim",
      am: "Aamir",
    };

    if (
      !sender &&
      query.get("s")
    ) {
      sender =
        STAFF_MAP[
          query.get("s")
        ] || "";
    }

    if (sender) {
      sender =
        sender
          .charAt(0)
          .toUpperCase() +
        sender.slice(1);

      nameBox.textContent =
        sender;
    } else {
      nameBox.textContent =
        "—";
    }
  }
);

/* =========================================================
   GUARDIAN WHATSAPP COUNTRY SELECTOR
========================================================= */

function initGuardianWhatsAppDropdown() {
  const input =
    document.getElementById(
      "gWhats"
    );

  if (!input) return;

  input.setAttribute(
    "inputmode",
    "tel"
  );

  input.setAttribute(
    "autocomplete",
    "tel"
  );

  /*
    Until a country is selected the
    phone number field remains locked.
  */
  input.readOnly = true;

  let countrySelected =
    false;

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.style.position =
    "relative";

  wrapper.style.width =
    "100%";

  const parent =
    input.parentNode;

  parent.insertBefore(
    wrapper,
    input
  );

  wrapper.appendChild(
    input
  );

  const dropdown =
    document.createElement(
      "div"
    );

  dropdown.style.position =
    "absolute";

  dropdown.style.top =
    "100%";

  dropdown.style.left =
    "0";

  dropdown.style.right =
    "0";

  dropdown.style.zIndex =
    "9999";

  dropdown.style.background =
    "#ffffff";

  dropdown.style.border =
    "1px solid #cbd5e1";

  dropdown.style.borderRadius =
    "6px";

  dropdown.style.marginTop =
    "4px";

  dropdown.style.boxShadow =
    "0 4px 12px rgba(15,23,42,0.12)";

  dropdown.style.display =
    "none";

  wrapper.appendChild(
    dropdown
  );

  const search =
    document.createElement(
      "input"
    );

  search.type =
    "text";

  search.placeholder =
    "Search country...";

  search.style.width =
    "100%";

  search.style.boxSizing =
    "border-box";

  search.style.padding =
    "7px 10px";

  search.style.border =
    "none";

  search.style.borderBottom =
    "1px solid #e2e8f0";

  search.style.outline =
    "none";

  dropdown.appendChild(
    search
  );

  const list =
    document.createElement(
      "div"
    );

  list.style.maxHeight =
    "200px";

  list.style.overflowY =
    "auto";

  dropdown.appendChild(
    list
  );

  /*
    Supported country calling codes.
  */
  const COUNTRIES = [
    ["Afghanistan", "+93"],
    ["Albania", "+355"],
    ["Algeria", "+213"],
    ["Andorra", "+376"],
    ["Angola", "+244"],
    ["Antigua and Barbuda", "+1268"],
    ["Argentina", "+54"],
    ["Armenia", "+374"],
    ["Australia", "+61"],
    ["Austria", "+43"],
    ["Azerbaijan", "+994"],

    ["Bahamas", "+1242"],
    ["Bahrain", "+973"],
    ["Bangladesh", "+880"],
    ["Barbados", "+1246"],
    ["Belarus", "+375"],
    ["Belgium", "+32"],
    ["Belize", "+501"],
    ["Benin", "+229"],
    ["Bhutan", "+975"],
    ["Bolivia", "+591"],
    ["Bosnia and Herzegovina", "+387"],
    ["Botswana", "+267"],
    ["Brazil", "+55"],
    ["Brunei Darussalam", "+673"],
    ["Bulgaria", "+359"],
    ["Burkina Faso", "+226"],
    ["Burundi", "+257"],

    ["Cabo Verde", "+238"],
    ["Cambodia", "+855"],
    ["Cameroon", "+237"],
    ["Canada", "+1"],
    ["Central African Republic", "+236"],
    ["Chad", "+235"],
    ["Chile", "+56"],
    ["China", "+86"],
    ["Colombia", "+57"],
    ["Comoros", "+269"],
    ["Congo", "+242"],
    ["Congo, Democratic Republic", "+243"],
    ["Costa Rica", "+506"],
    ["Côte d’Ivoire", "+225"],
    ["Croatia", "+385"],
    ["Cuba", "+53"],
    ["Cyprus", "+357"],
    ["Czech Republic", "+420"],

    ["Denmark", "+45"],
    ["Djibouti", "+253"],
    ["Dominica", "+1767"],
    ["Dominican Republic", "+1809"],

    ["Ecuador", "+593"],
    ["Egypt", "+20"],
    ["El Salvador", "+503"],
    ["Equatorial Guinea", "+240"],
    ["Eritrea", "+291"],
    ["Estonia", "+372"],
    ["Eswatini", "+268"],
    ["Ethiopia", "+251"],

    ["Fiji", "+679"],
    ["Finland", "+358"],
    ["France", "+33"],

    ["Gabon", "+241"],
    ["Gambia", "+220"],
    ["Georgia", "+995"],
    ["Germany", "+49"],
    ["Ghana", "+233"],
    ["Greece", "+30"],
    ["Grenada", "+1473"],
    ["Guatemala", "+502"],
    ["Guinea", "+224"],
    ["Guinea-Bissau", "+245"],
    ["Guyana", "+592"],

    ["Haiti", "+509"],
    ["Honduras", "+504"],
    ["Hungary", "+36"],

    ["Iceland", "+354"],
    ["India", "+91"],
    ["Indonesia", "+62"],
    ["Iran", "+98"],
    ["Iraq", "+964"],
    ["Ireland", "+353"],
    ["Israel", "+972"],
    ["Italy", "+39"],

    ["Jamaica", "+1876"],
    ["Japan", "+81"],
    ["Jordan", "+962"],

    ["Kazakhstan", "+7"],
    ["Kenya", "+254"],
    ["Kiribati", "+686"],
    ["Kuwait", "+965"],
    ["Kyrgyzstan", "+996"],

    ["Laos", "+856"],
    ["Latvia", "+371"],
    ["Lebanon", "+961"],
    ["Lesotho", "+266"],
    ["Liberia", "+231"],
    ["Libya", "+218"],
    ["Liechtenstein", "+423"],
    ["Lithuania", "+370"],
    ["Luxembourg", "+352"],

    ["Madagascar", "+261"],
    ["Malawi", "+265"],
    ["Malaysia", "+60"],
    ["Maldives", "+960"],
    ["Mali", "+223"],
    ["Malta", "+356"],
    ["Marshall Islands", "+692"],
    ["Mauritania", "+222"],
    ["Mauritius", "+230"],
    ["Mexico", "+52"],
    ["Micronesia", "+691"],
    ["Moldova", "+373"],
    ["Monaco", "+377"],
    ["Mongolia", "+976"],
    ["Montenegro", "+382"],
    ["Morocco", "+212"],
    ["Mozambique", "+258"],
    ["Myanmar", "+95"],

    ["Namibia", "+264"],
    ["Nauru", "+674"],
    ["Nepal", "+977"],
    ["Netherlands", "+31"],
    ["New Zealand", "+64"],
    ["Nicaragua", "+505"],
    ["Niger", "+227"],
    ["Nigeria", "+234"],
    ["North Korea", "+850"],
    ["North Macedonia", "+389"],
    ["Norway", "+47"],

    ["Oman", "+968"],

    ["Pakistan", "+92"],
    ["Palau", "+680"],
    ["Palestine", "+970"],
    ["Panama", "+507"],
    ["Papua New Guinea", "+675"],
    ["Paraguay", "+595"],
    ["Peru", "+51"],
    ["Philippines", "+63"],
    ["Poland", "+48"],
    ["Portugal", "+351"],

    ["Qatar", "+974"],

    ["Romania", "+40"],
    ["Russia", "+7"],
    ["Rwanda", "+250"],

    ["Saint Kitts and Nevis", "+1869"],
    ["Saint Lucia", "+1758"],
    ["Saint Vincent and the Grenadines", "+1784"],
    ["Samoa", "+685"],
    ["San Marino", "+378"],
    ["Sao Tome and Principe", "+239"],
    ["Saudi Arabia", "+966"],
    ["Senegal", "+221"],
    ["Serbia", "+381"],
    ["Seychelles", "+248"],
    ["Sierra Leone", "+232"],
    ["Singapore", "+65"],
    ["Slovakia", "+421"],
    ["Slovenia", "+386"],
    ["Solomon Islands", "+677"],
    ["Somalia", "+252"],
    ["South Africa", "+27"],
    ["South Korea", "+82"],
    ["South Sudan", "+211"],
    ["Spain", "+34"],
    ["Sri Lanka", "+94"],
    ["Sudan", "+249"],
    ["Suriname", "+597"],
    ["Sweden", "+46"],
    ["Switzerland", "+41"],
    ["Syria", "+963"],

    ["Taiwan", "+886"],
    ["Tajikistan", "+992"],
    ["Tanzania", "+255"],
    ["Thailand", "+66"],
    ["Timor-Leste", "+670"],
    ["Togo", "+228"],
    ["Tonga", "+676"],
    ["Trinidad and Tobago", "+1868"],
    ["Tunisia", "+216"],
    ["Turkey", "+90"],
    ["Turkmenistan", "+993"],
    ["Tuvalu", "+688"],

    ["Uganda", "+256"],
    ["Ukraine", "+380"],
    ["United Arab Emirates", "+971"],
    ["United Kingdom", "+44"],
    ["United States", "+1"],
    ["Uruguay", "+598"],
    ["Uzbekistan", "+998"],

    ["Vanuatu", "+678"],
    ["Vatican City", "+39"],
    ["Venezuela", "+58"],
    ["Vietnam", "+84"],

    ["Yemen", "+967"],

    ["Zambia", "+260"],
    ["Zimbabwe", "+263"],
  ].map(
    ([name, dial]) => ({
      name,
      dial,
    })
  );

  function renderList(
    filter = ""
  ) {
    const term =
      filter
        .trim()
        .toLowerCase();

    list.innerHTML = "";

    const filtered =
      COUNTRIES.filter(
        (country) => {
          if (!term) {
            return true;
          }

          return (
            country.name
              .toLowerCase()
              .includes(term) ||
            country.dial
              .replace("+", "")
              .startsWith(
                term.replace(
                  "+",
                  ""
                )
              )
          );
        }
      );

    filtered.forEach(
      (country) => {
        const item =
          document.createElement(
            "div"
          );

        item.textContent =
          `${country.name} (${country.dial})`;

        item.style.padding =
          "7px 10px";

        item.style.cursor =
          "pointer";

        item.style.fontSize =
          "13px";

        item.addEventListener(
          "mouseenter",
          () => {
            item.style.background =
              "#e5f2ff";
          }
        );

        item.addEventListener(
          "mouseleave",
          () => {
            item.style.background =
              "transparent";
          }
        );

        item.addEventListener(
          "click",
          () => {
            applyCountry(
              country,
              true
            );

            closeDropdown();

            input.focus();

            input.setSelectionRange(
              input.value.length,
              input.value.length
            );
          }
        );

        list.appendChild(
          item
        );
      }
    );

    if (!filtered.length) {
      const empty =
        document.createElement(
          "div"
        );

      empty.textContent =
        "No matches";

      empty.style.padding =
        "7px 10px";

      empty.style.fontSize =
        "12px";

      empty.style.color =
        "#64748b";

      list.appendChild(
        empty
      );
    }
  }

  function applyCountry(
    country,
    fromUser = false
  ) {
    let localNumber = "";

    /*
      Preserve the existing local number
      when switching country.
    */
    if (
      input.dataset.currentDial &&
      input.value.startsWith(
        input.dataset.currentDial
      )
    ) {
      localNumber =
        input.value.slice(
          input.dataset.currentDial.length
        );
    }

    localNumber =
      localNumber.replace(
        /\D/g,
        ""
      );

    input.value =
      country.dial +
      localNumber;

    input.dataset.currentDial =
      country.dial;

    input.dataset.currentCode =
      country.dial.replace(
        /\D/g,
        ""
      );

    if (fromUser) {
      countrySelected =
        true;

      input.readOnly =
        false;
    }
  }

  function openDropdown() {
    dropdown.style.display =
      "block";

    search.value = "";

    renderList();

    setTimeout(
      () => {
        search.focus();
      },
      0
    );
  }

  function closeDropdown() {
    dropdown.style.display =
      "none";
  }

  input.addEventListener(
    "focus",
    openDropdown
  );

  input.addEventListener(
    "click",
    openDropdown
  );

  search.addEventListener(
    "input",
    () => {
      renderList(
        search.value
      );
    }
  );

  /*
    Clicking search should not close
    the dropdown.
  */
  search.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        !wrapper.contains(
          event.target
        )
      ) {
        closeDropdown();
      }
    }
  );

  /*
    Protect the selected country code.
  */
  input.addEventListener(
    "input",
    () => {
      const dial =
        input.dataset.currentDial ||
        "";

      if (
        !dial ||
        !countrySelected
      ) {
        input.value = "";

        input.readOnly =
          true;

        countrySelected =
          false;

        input.dataset.currentDial =
          "";

        input.dataset.currentCode =
          "";

        return;
      }

      /*
        Allow local number digits only.
      */
      if (
        !input.value.startsWith(
          dial
        )
      ) {
        input.value =
          dial;

        return;
      }

      const local =
        input.value
          .slice(
            dial.length
          )
          .replace(
            /\D/g,
            ""
          );

      input.value =
        dial +
        local;
    }
  );

  /*
    Prevent deleting the country code
    with Backspace/Delete.
  */
  input.addEventListener(
    "keydown",
    (event) => {
      const dial =
        input.dataset.currentDial ||
        "";

      if (!dial) return;

      const start =
        input.selectionStart || 0;

      const end =
        input.selectionEnd || 0;

      if (
        event.key ===
          "Backspace" &&
        start <=
          dial.length
      ) {
        event.preventDefault();

        input.setSelectionRange(
          dial.length,
          dial.length
        );
      }

      if (
        event.key ===
          "Delete" &&
        start <
          dial.length
      ) {
        event.preventDefault();

        input.setSelectionRange(
          dial.length,
          Math.max(
            dial.length,
            end
          )
        );
      }
    }
  );
}