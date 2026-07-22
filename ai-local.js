const question = document.getElementById("aiQuestion");
const passage = document.getElementById("aiPassage");
const askButton = document.getElementById("askLocalAI");
const aiStatus = document.getElementById("aiStatus");
const answer = document.getElementById("aiAnswer");
const worker = new Worker("./ai-worker.js", { type: "module" });

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
  return parts.join("\n\n").slice(0, 7000);
}

worker.onmessage = (event) => {
  const data = event.data || {};
  if (data.type === "progress") {
    const p = data.progress || {};
    const percent = Number.isFinite(p.progress) ? " " + Math.round(p.progress) + " %" : "";
    aiStatus.textContent = "Téléchargement du modèle" + percent + " — garde cette page ouverte.";
  } else if (data.type === "ready") {
    aiStatus.textContent = "IA locale prête sur cet appareil.";
  } else if (data.type === "answer") {
    askButton.disabled = false;
    answer.textContent = data.answer || "Le modèle n’a pas produit de réponse.";
    aiStatus.textContent = "Réponse produite localement. Aucune note n’a été envoyée à un serveur.";
    localStorage.setItem("bsc-ai-passage", passage.value);
    localStorage.setItem("bsc-ai-question", question.value);
    localStorage.setItem("bsc-ai-answer", answer.textContent);
  } else if (data.type === "error") {
    askButton.disabled = false;
    aiStatus.textContent = "Erreur : " + data.message;
    answer.textContent = "Essaie avec Chrome ou Edge récent sur un ordinateur disposant de suffisamment de mémoire.";
  }
};

askButton.addEventListener("click", () => {
  const q = question.value.trim();
  if (!q) {
    aiStatus.textContent = "Écris d’abord une question.";
    question.focus();
    return;
  }
  askButton.disabled = true;
  answer.textContent = "";
  aiStatus.textContent = navigator.gpu
    ? "Chargement de l’IA avec l’accélération graphique…"
    : "Chargement de l’IA sur le processeur… cela peut être long.";
  worker.postMessage({
    type: "ask",
    question: q,
    passage: passage.value.trim(),
    notes: collectPrivateNotes()
  });
});

passage.value = localStorage.getItem("bsc-ai-passage") || "";
question.value = localStorage.getItem("bsc-ai-question") || "";
answer.textContent = localStorage.getItem("bsc-ai-answer") || "";
