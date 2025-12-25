// constants.js (sin módulos, variables globales)
const STORAGE_KEY = "juicio_secreto_v1";
const AUDIO_SETTINGS_KEY = "juicio_audio_v1";

// EXACTO: 6 preguntas, 4 respuestas cada una
const QUESTIONS = [
  {
    id: "q1",
    text: "¿Qué hace un viernes a las 11pm?",
    options: [
      { label: "Sale y desaparece" },
      { label: "Está en casa viendo algo" },
      { label: "Anda trabajando o estudiando" },
      { label: "Depende del mood, pero contesta tarde" },
    ],
  },
  {
    id: "q2",
    text: "Si le cancelan planes, ¿cómo reacciona?",
    options: [
      { label: "Le vale y arma otro plan" },
      { label: "Se enoja por dentro" },
      { label: "Agradece y duerme" },
      { label: "Pregunta el chisme primero" },
    ],
  },
  {
    id: "q3",
    text: "En un grupo, es el que…",
    options: [
      { label: "Manda memes" },
      { label: "No responde nunca" },
      { label: "Organiza todo" },
      { label: "Solo aparece cuando hay drama" },
    ],
  },
  {
    id: "q4",
    text: "Si se pierde en la calle, hace…",
    options: [
      { label: "Se guía por intuición (mal)" },
      { label: "Usa Maps y aún así se equivoca" },
      { label: "Pregunta a alguien" },
      { label: "Se regresa por donde vino" },
    ],
  },
  {
    id: "q5",
    text: "Su debilidad real es…",
    options: [
      { label: "La comida" },
      { label: "El ego" },
      { label: "La flojera" },
      { label: "El celular" },
    ],
  },
  {
    id: "q6",
    text: "Cuando toma una decisión, suele…",
    options: [
      { label: "Pensarlo demasiado" },
      { label: "Hacerlo impulsivo" },
      { label: "Pedir opinión a todos" },
      { label: "Hacer lo que quería desde el inicio" },
    ],
  },
];
