const greetings = [
  "Hello, World!",
  "Hello, GitHub Pages!",
  "Hello, from vanilla JavaScript!",
  "Hello, again!",
];

const greetingElement = document.getElementById("greeting");
const changeButton = document.getElementById("change-greeting");

let greetingIndex = 0;

function cycleGreeting() {
  greetingIndex = (greetingIndex + 1) % greetings.length;
  greetingElement.textContent = greetings[greetingIndex];
}

changeButton.addEventListener("click", cycleGreeting);
