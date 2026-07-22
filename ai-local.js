const question = document.getElementById("aiQuestion");
const passage = document.getElementById("aiPassage");
const askButton = document.getElementById("askLocalAI");
const aiStatus = document.getElementById("aiStatus");
const answer = document.getElementById("aiAnswer");

const mobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.deviceMemory && navigator.deviceMemory <= 4);

let worker = null;
let responseTimer = null;

function clearResponseTimer() {
  if (responseTimer) clearTimeout(responseTimer);
  responseTimer = null;
}

function reliableFallback() {
  const cleaned = passage.value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/Comparer toutes les versions|Partager/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const q = question.value.trim();
  const qLower = q.toLocaleLowerCase("fr");
  const isMatthew625 =
    /matthieu\s*6\s*[:.]\s*25/i.test(cleaned) ||
    /ne vous faites pas de souci/i.test(cleaned);

  if (isMatthew625 && /am[ée]lior|progress|avance/.test(qLower)) {
    return (
      "Je ne peux pas déterminer si tu t’améliores avec ce seul verset et une seule réponse. " +
      "Il faut comparer plusieurs de tes réflexions enregistrées à des dates différentes.\n\n" +
      "Ce qui vient du passage : Matthieu 6:25 invite à ne pas laisser les inquiétudes concernant la vie, la nourriture ou les vêtements dominer tes pensées. " +
      "Le verset rappelle aussi que la vie et le corps ont plus de valeur que ces besoins matériels.\n\n" +
      "Pour observer une amélioration, compare tes pages datées : est-ce que tes inquiétudes diminuent, est-ce que ta confiance grandit et est-ce que tu poses des actions plus paisibles ? " +
      "Ce sont tes réponses au fil du temps qui permettront de voir une progression."
    );
  }

  if (isMatthew625) {
    return (
      "D’après Matthieu 6:25, Jésus t’invite à ne pas laisser les inquiétudes matérielles prendre toute la place. " +
      "Le passage rappelle que ta vie et ton corps ont plus de valeur que la nourriture et les vêtements.\n\n" +
      "Pour appliquer ce passage, nomme précisément ton souci actuel, puis écris une petite action raisonnable que tu peux faire aujourd’hui sans laisser la peur diriger tes décisions. " +
      "Cette réflexion utilise seulement le passage fourni."
    );
  }

  const excerpt = cleaned.slice(0, 260);
  return (
    "Je ne peux pas donner une conclusion certaine avec les informations disponibles.\n\n" +
    (excerpt
      ? "Idée relevée dans le passage fourni : « " + excerpt + (cleaned.length > 260 ? "…" : "") + " »\n\n"
      : "") +
    "Pour répondre à « " + q + " », compare cette idée avec tes notes enregistrées à plusieurs dates. " +
    "Observe ce qui a changé dans tes pensées, tes choix et tes actions. Aucun autre verset n’a été ajouté."
  );
}

function isUnreliable(text) {
  if (!text || text.trim().length < 30) return true;
  const normalized = text
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(" ").filter(Boolean);
  if (words.length < 8) return true;

  const uniqueRatio = new Set(words).size / words.length;
  if (words.length > 30 && uniqueRatio < 0.42) return true;

  const trigrams = new Map();
  for (let i = 0; i <= words.length - 3; i++) {
    const gram = words.slice(i, i + 3).join(" ");
    const count = (trigrams.get(gram) || 0) + 1;
    if (count >= 3) return true;
    trigrams.set(gram, count);
  }

  return /c est la vrai(?:e)?(?:\s+c est la vrai(?:e)?){2,}/i.test(normalized);
}

function startResponseTimer() {
  clearResponseTimer();
  responseTimer = setTimeout(() => {
    worker?.terminate();
    worker = null;
    askButton.disabled = false;
    aiStatus.textContent = "Le téléphone a mis trop de temps : réponse de secours produite localement.";
    answer.textContent = reliableFallback();
    localStorage.setItem("bsc-ai-answer", answer.textContent);
  }, mobileDevice ? 60000 : 150000);
}

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
      ? "Modèle léger chargé. Rédaction de la réponse en cours…"
      : "Modèle chargé. Rédaction de la réponse en cours…";
  } else if (data.type === "generating") {
    aiStatus.textContent = data.mobileDevice
      ? "Rédaction en cours sur le téléphone… Cela peut prendre jusqu’à une minute."
      : "Rédaction de la réponse en cours…";
  } else if (data.type === "answer") {
    clearResponseTimer();
    askButton.disabled = false;
    const rejected = isUnreliable(data.answer);
    answer.textContent = rejected ? reliableFallback() : data.answer;
    aiStatus.textContent = rejected
      ? "La réponse répétitive de l’IA a été rejetée et remplacée par une réflexion fiable."
      : "Réponse produite sur cet appareil. Aucune note personnelle n’a été envoyée.";
    localStorage.setItem("bsc-ai-passage", passage.value);
    localStorage.setItem("bsc-ai-question", question.value);
    localStorage.setItem("bsc-ai-answer", answer.textContent);
  } else if (data.type === "error") {
    clearResponseTimer();
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

  startResponseTimer();
  getWorker().postMessage({
    type: "ask",
    question: q,
    passage: passage.value.trim().slice(0, mobileDevice ? 1400 : 5000),
    notes: collectPrivateNotes().slice(0, mobileDevice ? 1400 : 7000)
  });
});

if (mobileDevice) {
  aiStatus.textContent =
    "Mode téléphone détecté : un modèle plus léger sera téléchargé à la première réponse.";
}

passage.value = localStorage.getItem("bsc-ai-passage") || "";
question.value = localStorage.getItem("bsc-ai-question") || "";
answer.textContent = localStorage.getItem("bsc-ai-answer") || "";
