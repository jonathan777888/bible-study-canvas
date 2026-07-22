const question = document.getElementById("aiQuestion");
const passage = document.getElementById("aiPassage");
const askButton = document.getElementById("askLocalAI");
const aiStatus = document.getElementById("aiStatus");
const answer = document.getElementById("aiAnswer");

const mobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);

let worker = null;
function getWorker() {
  if (worker) return worker;
  worker = new Worker("./ai-worker.js?v=2", { type: "module" });
  worker.onmessage = handleWorkerMessage;
  worker.onerror = () => {
    askButton.disabled = false;
    aiStatus.textContent = "Le navigateur a arrêté le moteur local.";
    answer.textContent =
      "Ferme les autres onglets, actualise la page puis réessaie. Si le problème continue, utilise Chrome ou Edge sur un ordinateur.";
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function collectPrivateNotes() {
  const parts = [];
  const freeText = document.getElementById("editor")?.value?.trim();
  const verse = document.getElementById("verse")?.value?.trim();
  const reference = document.getElementById("reference")?.value?.trim();
  if (freeText) parts.push("Page libre : " + freeText);
  if (verse) parts.push("Verset noté : " + verse + (reference ? " (" + reference + ")" : ""));
  document.querySelectorAll(".relationCard").forEach((card) => {
    const label = card.querySelector("label")?.textContent?.trim();
    const value = card.querySelector("textarea")?.value?.trim();
    if (label && value) parts.push(label + "\nRéponse personnelle : " + value);
  });
  return parts.join("\n\n").slice(0, mobileDevice ? 2800 : 7000);
}

function handleWorkerMessage(event) {
  const data = event.data || {};
  if (data.type === "loading") {
    aiStatus.textContent = data.mobileDevice
      ? "Préparation du modèle léger pour téléphone… Ne quitte pas cette page."
      : "Préparation du modèle local pour ordinateur…";
  } else if (data.type === "progress") {
    const p = data.progress || {};
    const percent = Number.isFinite(p.progress) ? " " + Math.round(p.progress) + " %" : "";
    aiStatus.textContent =
      "Téléchargement du modèle " + (data.mobileDevice ? "léger" : "local") +
      percent + " — garde cette page ouverte.";
  } else if (data.type === "ready") {
    aiStatus.textContent = data.mobileDevice
      ? "IA légère prête sur ce téléphone."
      : "IA locale prête sur cet appareil.";
  } else if (data.type === "answer") {
    askButton.disabled = false;
    answer.textContent = data.answer || "Le modèle n’a pas produit de réponse.";
    aiStatus.textContent =
      "Réponse produite sur cet appareil. Aucune note personnelle n’a été envoyée.";
    localStorage.setItem("bsc-ai-passage", passage.value);
    localStorage.setItem("bsc-ai-question", question.value);
    localStorage.setItem("bsc-ai-answer", answer.textContent);
  } else if (data.type === "error") {
    askButton.disabled = false;
    aiStatus.textContent = "Le moteur local n’a pas pu démarrer.";
    answer.textContent =
      "Ferme les autres onglets et actualise la page. Vérifie aussi que plusieurs centaines de Mo sont libres. Détail : " +
      data.message;
    worker?.terminate();
    worker = null;
  }
}

askButton.addEventListener("click", () => {
  const q = question.value.trim();
  if (!q) {
    aiStatus.textContent = "Écris d’abord une question.";
    question.focus();
    return;
  }
  askButton.disabled = true;
  answer.textContent = "";
  aiStatus.textContent = mobileDevice
    ? "Chargement de l’IA légère pour téléphone…"
    : navigator.gpu
      ? "Chargement avec l’accélération graphique…"
      : "Chargement sur le processeur… cela peut être long.";

  getWorker().postMessage({
    type: "ask",
    question: q,
    passage: passage.value.trim().slice(0, mobileDevice ? 2200 : 5000),
    notes: collectPrivateNotes()
  });
});

if (mobileDevice) {
  aiStatus.textContent =
    "Mode téléphone détecté : un modèle plus léger sera téléchargé à la première réponse.";
}

passage.value = localStorage.getItem("bsc-ai-passage") || "";
question.value = localStorage.getItem("bsc-ai-question") || "";
answer.textContent = localStorage.getItem("bsc-ai-answer") || "";
