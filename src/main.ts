import "./style.css";
import characterMatrices from "../character_matrices.json";
import {
  interpolateFramesRandomFlip,
  interpolateFramesRandomMap,
  interpolateFramesApproximateOT,
} from "./interpolations";

type CharacterMatrix = number[][];

interface CharacterMatrices {
  [key: string]: {
    values: number[];
    lengths: number[];
    width: number;
    height: number;
  };
}

const typedCharacterMatrices: CharacterMatrices =
  characterMatrices as CharacterMatrices;

function decodeMatrix(encoded: {
  values: number[];
  lengths: number[];
  width: number;
  height: number;
}): CharacterMatrix {
  let flatMatrix: number[] = [];
  for (let i = 0; i < encoded.values.length; i++) {
    flatMatrix = flatMatrix.concat(
      Array(encoded.lengths[i]).fill(encoded.values[i])
    );
  }
  const matrix: CharacterMatrix = [];
  for (let i = 0; i < encoded.height; i++) {
    matrix.push(flatMatrix.slice(i * encoded.width, (i + 1) * encoded.width));
  }
  return matrix;
}

function getRandomChar(): string {
  return String.fromCharCode(33 + Math.floor(Math.random() * 94));
}

class Display {
  private container: HTMLElement;
  public rows: number;
  public cols: number;
  private grid: string[][];
  private backgroundColor: string;
  private textColor: string;
  private currentWord: Word | null = null;
  private fontSize: number;
  private toolbarOptions: string[];
  private toolbarElement: HTMLElement | null = null;
  private autoplayInterval: number | null = null;
  private autoplayLink: HTMLElement | null = null;

  constructor() {
    this.fontSize = this.calculateFontSize();
    [this.backgroundColor, this.textColor] = this.getRandomColors();
    this.container = this.createContainer();
    [this.rows, this.cols] = this.computeGridSize();
    this.grid = [];
    this.toolbarOptions = ["Randomize Color", "Start Autoplay"];
    this.initializeGrid();
  }

  private calculateFontSize(): number {
    const screenWidth = window.innerWidth;
    const scaleFactor = 0.008; // 2% of the smaller dimension

    return Math.min(screenWidth * scaleFactor, 16);
  }

  private getRandomColors(): [string, string] {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 30 + Math.floor(Math.random() * 20); // 30-50%
    const bgLightness = 10 + Math.floor(Math.random() * 15); // 10-25%
    const textLightness = 80 + Math.floor(Math.random() * 15); // 80-95%

    const backgroundColor = `hsl(${hue}, ${saturation}%, ${bgLightness}%)`;
    const textColor = `hsl(${hue}, ${saturation}%, ${textLightness}%)`;

    return [backgroundColor, textColor];
  }

  private createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.overflow = "hidden";
    container.style.backgroundColor = this.backgroundColor;
    container.style.color = this.textColor;
    container.style.fontFamily = "monospace";
    container.style.fontSize = `${this.fontSize}px`;
    container.style.lineHeight = "1";
    container.style.letterSpacing = "0px";
    container.style.whiteSpace = "pre";
    document.body.appendChild(container);
    return container;
  }
  private computeGridSize(): [number, number] {
    const testSpan = document.createElement("span");
    testSpan.textContent = "X";
    this.container.appendChild(testSpan);

    this.container.style.fontSize = `${this.fontSize}px`;

    const rect = testSpan.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(testSpan).lineHeight);

    const rows = Math.floor(window.innerHeight / lineHeight);
    const cols = Math.floor(window.innerWidth / rect.width);

    console.log(`Grid size: ${rows} rows x ${cols} columns`);
    console.log(`Font size: ${this.fontSize}px`);

    this.container.removeChild(testSpan);
    return [rows, cols];
  }

  private initializeGrid(): void {
    this.grid = Array(this.rows)
      .fill(null)
      .map(() => Array(this.cols).fill(" "));
    this.updateDisplay(this.grid);
  }

  updateDisplay(frame: string[][]): void {
    // Overwrite the bottom row with toolbar options
    const toolbarRow = this.createToolbarRow();
    frame[frame.length - 1] = toolbarRow;

    const text = frame.map((row) => row.join("")).join("\n");
    this.container.textContent = text;
  }
  updateDisplayHTML(frame: string[][]): void {
    console.log("updateDisplayHTML");
    if (!this.currentWord) {
      console.error("No current word set");
      return;
    }

    // Overwrite the bottom row with toolbar options
    const toolbarRow = this.createToolbarRow();
    frame[frame.length - 1] = toolbarRow;

    const html = frame
      .map((row, index) => {
        if (index === frame.length - 1) {
          // Create a separate element for the toolbar
          return `<div id="toolbar">${row.join("")}</div>`;
        }
        const rowHtml = row.join("").replace(/\b\w+\b|\w+/g, (word) => {
          const guessedWord = this.guessFullWord(word);
          return `<a href="#${guessedWord}" style="color: inherit; text-decoration: none;">${word}</a>`;
        });
        return `<span>${rowHtml}</span>`;
      })
      .join("\n");
    this.container.innerHTML = html;

    // Set up the toolbar after updating the HTML
    this.setupToolbar();
  }

  private setupToolbar(): void {
    this.toolbarElement = document.getElementById("toolbar");
    if (this.toolbarElement) {
      this.toolbarElement.innerHTML = this.toolbarElement.innerHTML
        .replace(
          /Randomize Color/g,
          '<a href="#" id="randomizeColorLink" style="color: inherit; text-decoration: none;">Randomize Color</a>'
        )
        .replace(
          /Start Autoplay|Stop Autoplay/g,
          '<a href="#" id="autoplayLink" style="color: inherit; text-decoration: none;">' +
            (this.autoplayInterval ? "Stop Autoplay" : "Start Autoplay") +
            "</a>"
        );

      const randomizeColorLink = document.getElementById("randomizeColorLink");
      if (randomizeColorLink) {
        randomizeColorLink.addEventListener("click", (e) => {
          e.preventDefault();
          this.randomizeColor();
        });
      }

      this.autoplayLink = document.getElementById("autoplayLink");
      if (this.autoplayLink) {
        this.autoplayLink.addEventListener("click", (e) => {
          e.preventDefault();
          this.toggleAutoplay();
        });
      }
    }
  }

  private guessFullWord(partialWord: string): string {
    if (!this.currentWord) {
      return partialWord;
    }

    const lowerPartial = partialWord.toLowerCase();

    for (const word of this.currentWord.related_words) {
      const lowerWord = word.toLowerCase();
      if (
        lowerWord.startsWith(lowerPartial) ||
        lowerWord.endsWith(lowerPartial)
      ) {
        return word;
      }
    }

    // If no exact match, try finding a word that contains the partial word as a substring
    for (const word of this.currentWord.related_words) {
      const lowerWord = word.toLowerCase();
      if (lowerWord.includes(lowerPartial)) {
        return word;
      }
    }

    console.error(`No full word found for: ${partialWord}`);
    return partialWord;
  }

  private createToolbarRow(): string[] {
    const autoplayText = this.autoplayInterval
      ? "Stop Autoplay"
      : "Start Autoplay";
    const toolbarText = `Randomize Color | ${autoplayText}`;
    const padding = " ".repeat(
      Math.floor((this.cols - toolbarText.length) / 2)
    );
    return (padding + toolbarText + padding).slice(0, this.cols).split("");
  }

  clear(): void {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        this.grid[i][j] = " ";
      }
    }
  }

  set(asciiGrid: string[][]): void {
    if (asciiGrid.length !== this.rows || asciiGrid[0].length !== this.cols) {
      console.error(
        `Input grid dimensions (${asciiGrid.length}x${asciiGrid[0].length}) do not match the display dimensions (${this.rows}x${this.cols})`
      );
      return;
    }
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        this.grid[i][j] = asciiGrid[i][j];
      }
    }
  }

  setCurrentWord(word: Word): void {
    this.currentWord = word;
  }

  randomizeColor(): void {
    [this.backgroundColor, this.textColor] = this.getRandomColors();
    this.container.style.backgroundColor = this.backgroundColor;
    this.container.style.color = this.textColor;
  }

  toggleAutoplay(): void {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
      this.autoplayInterval = null;
      if (this.autoplayLink) {
        this.autoplayLink.textContent = "Start Autoplay";
      }
      console.log("Autoplay stopped");
    } else {
      this.autoplayInterval = setInterval(() => {
        if (this.currentWord && this.currentWord.related_words.length > 0) {
          const randomWord =
            this.currentWord.related_words[
              Math.floor(Math.random() * this.currentWord.related_words.length)
            ];
          window.location.hash = randomWord;
        }
      }, 5000);
      if (this.autoplayLink) {
        this.autoplayLink.textContent = "Stop Autoplay";
      }
      console.log("Autoplay started");
    }
  }
}

class Mask {
  private grid: boolean[][];

  constructor(public rows: number, public cols: number) {
    this.grid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
  }

  setSquare(startRow: number, startCol: number, size: number): void {
    for (let i = startRow; i < startRow + size && i < this.rows; i++) {
      for (let j = startCol; j < startCol + size && j < this.cols; j++) {
        this.grid[i][j] = true;
      }
    }
  }

  isVisible(row: number, col: number): boolean {
    return this.grid[row][col];
  }
}

class Layer {
  public grid: string[][];
  public offset_x: number; // may be float
  public offset_y: number;
  constructor(public rows: number, public cols: number) {
    this.grid = Array(rows)
      .fill(null)
      .map(() =>
        Array(cols)
          .fill(null)
          .map(() => getRandomChar())
      );
    this.offset_x = 0;
    this.offset_y = 0;
  }

  getChar(row: number, col: number): string {
    const rows = this.grid.length;
    const cols = this.grid[0].length;
    row = (row + Math.floor(this.offset_y) + rows) % rows;
    col = (col + Math.floor(this.offset_x) + cols) % cols;
    row = (row + rows) % rows;
    col = (col + cols) % cols;
    return this.grid[row][col];
  }

  tileWithWords(words: string[]): void {
    for (const row of this.grid) {
      let colIdx = 0;
      while (colIdx < row.length) {
        const randomWord = words[Math.floor(Math.random() * words.length)];
        for (let k = 0; k < randomWord.length && colIdx < row.length; k++) {
          row[colIdx] = randomWord[k];
          colIdx++;
        }

        // Add padding
        for (
          let k = 0;
          k < 2 + Math.floor(Math.random() * 4) && colIdx < row.length;
          k++
        ) {
          row[colIdx] = ".";
          colIdx++;
        }
      }
    }
  }
}

class Letter {
  public mask: Mask;
  public layer: Layer;
  public related_words: string[];
  public dx: number;
  public dy: number;

  constructor(
    rows: number,
    cols: number,
    character: string,
    startRow: number,
    startCol: number,
    size: number,
    related_words: string[],
    scroll_speed: number = 1
  ) {
    this.mask = new Mask(rows, cols);
    this.layer = new Layer(rows, cols);
    this.related_words = related_words;

    const random_angle = Math.random() * 2 * Math.PI;
    this.dx = scroll_speed * Math.cos(random_angle);
    this.dy = scroll_speed * Math.sin(random_angle);

    const encodedMatrix = typedCharacterMatrices[character];
    if (!encodedMatrix) {
      console.error(`No matrix found for character: ${character}`);
      return;
    }

    const matrix = decodeMatrix(encodedMatrix);

    if (related_words.length > 0) {
      this.layer.tileWithWords(related_words);
    }

    const matrixRows = matrix.length;
    const matrixCols = matrix[0].length;

    for (let i = 0; i < matrixRows; i++) {
      for (let j = 0; j < matrixCols; j++) {
        if (matrix[i][j] === 1) {
          const row = startRow + Math.floor((i * size) / matrixRows);
          const col = startCol + Math.floor((j * size) / matrixCols);
          if (row < rows && col < cols) {
            this.mask.setSquare(row, col, 1);
          }
        }
      }
    }
  }

  updateWords(new_words: string[]): void {
    this.related_words = new_words;
    this.layer.tileWithWords(new_words);
  }
}

class Word {
  public letters: Letter[];
  public related_words: string[];
  private canvas: Canvas;
  private isTransitioning: boolean = false;

  constructor(words: string[], rows: number, cols: number, canvas: Canvas) {
    this.letters = [];
    this.related_words = [];
    this.canvas = canvas;

    // Initialize with default words
    this.createLetters(words, rows, cols);

    // Fetch related words asynchronously
    this.fetchRelatedWords(words.join(" "));
    this.isTransitioning = true;
    this.startTransition();
  }

  private createLetters(words: string[], rows: number, cols: number): void {
    // Add padding factor (e.g., 0.9 means use 90% of the screen)
    const paddingFactor = 0.8;
    const availableRows = Math.floor(rows * paddingFactor);
    const availableCols = Math.floor(cols * paddingFactor);

    const maxLineWidth = Math.max(...words.map((word) => word.length));
    const maxLineHeight = words.length;

    // Calculate the maximum possible letter size with padding
    const letterSizeHorizontal = Math.floor(availableCols / maxLineWidth);
    const letterSizeVertical = Math.floor(availableRows / maxLineHeight);
    const letterSize = Math.min(letterSizeHorizontal, letterSizeVertical);

    // Calculate spacing (10% of letter size, minimum 1)
    const spacing = Math.max(1, Math.floor(letterSize * 0.1));

    const wordWidth = maxLineWidth * (letterSize + spacing) - spacing;
    const wordHeight = words.length * (letterSize + spacing) - spacing;

    // Calculate the starting position to center the word
    const startRow = Math.floor((rows - wordHeight) / 2);
    const startCol = Math.floor((cols - wordWidth) / 2);

    words.forEach((word, lineIndex) => {
      let currentCol =
        startCol +
        Math.floor(
          (wordWidth - word.length * (letterSize + spacing) + spacing) / 2
        );
      let currentRow = startRow + lineIndex * (letterSize + spacing);

      for (const char of word) {
        const letter = new Letter(
          rows,
          cols,
          char,
          currentRow,
          currentCol,
          letterSize,
          this.related_words
        );
        this.letters.push(letter);
        currentCol += letterSize + spacing;
      }
    });
  }

  private async fetchRelatedWords(word: string): Promise<void> {
    try {
      const response = await fetch(
        `https://suno-ai--related-words-generate-related-words.modal.run?input_word=${encodeURIComponent(
          word
        )}`
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      console.log(data);
      this.related_words = data.related_words
        ? data.related_words.split(",").map((word: string) => word.trim())
        : this.getDefaultRelatedWords();
      this.updateLettersWithNewWords();
      this.isTransitioning = false;
      isTransitioning = false;
    } catch (error) {
      console.error("Error fetching related words:", error);
      this.related_words = this.getDefaultRelatedWords();
      this.isTransitioning = false;
      isTransitioning = false;
    }
  }

  private getDefaultRelatedWords(): string[] {
    return [
      "melody",
      "harmony",
      "rhythm",
      "tempo",
      "pitch",
      "scale",
      "chord",
      "note",
      "tune",
      "beat",
      "symphony",
      "orchestra",
      "concert",
      "band",
      "guitar",
      "piano",
      "drums",
      "violin",
      "singer",
      "composer",
    ];
  }

  private updateLettersWithNewWords(): void {
    const currentFrame = this.canvas.getFrame();
    for (const letter of this.letters) {
      letter.updateWords(this.related_words);
    }
    // Generate interpolated frames using randomFlip
    const newFrame = this.canvas.getFrame(); // Assuming this is the updated frame
    const interpolatedFrames = interpolateFramesRandomFlip(
      currentFrame,
      newFrame,
      10
    ); // 10 steps, adjust as needed

    // Add all interpolated frames to the event loop
    for (const frame of interpolatedFrames) {
      eventLoop.addFrame(frame);
    }
  }

  private startTransition(): void {
    const transitionInterval = setInterval(() => {
      if (!this.isTransitioning) {
        clearInterval(transitionInterval);
        return;
      }
      this.randomlyFlipCharacters();
      // Update the canvas with the new frame
      eventLoop.addFrame(this.canvas.getFrame());
    }, 1000 / FPS); // Update at the same rate as FPS
  }

  private randomlyFlipCharacters(): void {
    const flipProbability = 0.05; // Adjust this value to control the rate of flipping
    for (const letter of this.letters) {
      for (let row = 0; row < letter.layer.rows; row++) {
        for (let col = 0; col < letter.layer.cols; col++) {
          if (
            letter.mask.isVisible(row, col) &&
            Math.random() < flipProbability
          ) {
            const randomChar = getRandomChar();
            letter.layer.grid[row][col] = randomChar;
          }
        }
      }
    }
  }

  addToCanvas(canvas: Canvas): void {
    for (const letter of this.letters) {
      canvas.addLayer(letter.layer, letter.mask);
    }
  }

  getCenterOfMass(): { x: number; y: number } {
    let totalX = 0;
    let totalY = 0;
    let totalPoints = 0;

    for (const letter of this.letters) {
      for (let row = 0; row < letter.mask.rows; row++) {
        for (let col = 0; col < letter.mask.cols; col++) {
          if (letter.mask.isVisible(row, col)) {
            totalX += col;
            totalY += row;
            totalPoints++;
          }
        }
      }
    }

    return {
      x: totalX / totalPoints,
      y: totalY / totalPoints,
    };
  }
}

class Canvas {
  private layers: Layer[] = [];
  private masks: Mask[] = [];

  constructor(public rows: number, public cols: number) {}

  addLayer(layer: Layer, mask: Mask): void {
    this.layers.push(layer);
    this.masks.push(mask);
  }

  getFrame(): string[][] {
    const frame = Array(this.rows)
      .fill(null)
      .map(() => Array(this.cols).fill(" "));

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const mask = this.masks[i];

      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          if (mask.isVisible(row, col)) {
            frame[row][col] = layer.getChar(row, col);
          }
        }
      }
    }

    return frame;
  }
}

const display = new Display();
const FPS = 30;
const TRANSITION_FRAMES = FPS / 3;
class EventLoop {
  private frameIndex: number = 0;
  public frames: string[][][] = [];
  private intervalId: number | null = null;
  private frameDuration: number;

  constructor() {
    this.frameDuration = 1000 / FPS;
  }

  addFrame(frame: string[][]): void {
    this.frames.push(frame);
  }

  addFrames(frames: string[][][]): void {
    this.frames.push(...frames);
  }

  lastFrame(): string[][] {
    return this.frames[this.frames.length - 1];
  }

  numRemainingFrames(): number {
    return this.frames.length - this.frameIndex;
  }

  start(): void {
    if (this.intervalId !== null) return; // Prevent multiple intervals

    this.intervalId = window.setInterval(() => {
      this.render();
    }, this.frameDuration);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private render(): void {
    if (this.frames.length === 0 || this.frameIndex >= this.frames.length)
      return;

    const frame = this.frames[this.frameIndex];
    if (this.frameIndex === this.frames.length - 1) {
      display.updateDisplayHTML(frame);
    } else {
      display.updateDisplay(frame);
    }

    // Clear old frames to save memory
    if (this.frameIndex > 0) {
      this.frames[this.frameIndex - 1] = [];
    }

    this.frameIndex = Math.min(this.frameIndex + 1, this.frames.length);
  }
}

const eventLoop = new EventLoop();
let lastWords: Word | null = null;
let lastCanvas: Canvas | null = null;

function init(words: string[]): string[][][] {
  const canvas = new Canvas(display.rows - 1, display.cols); // Subtract 1 row for toolbar

  const word1 = new Word(words, display.rows - 1, display.cols, canvas); // Subtract 1 row for toolbar
  display.setCurrentWord(word1);

  word1.addToCanvas(canvas);
  lastCanvas = canvas;
  lastWords = word1;
  return [canvas.getFrame()];
}
function getWordsFromHash(): string[] {
  const hash = decodeURIComponent(window.location.hash.substring(1));
  console.log(hash);
  if (hash.length === 0) {
    return [];
  }

  const words = hash.split(/[,\s]+/).filter((word) => word.length > 0);
  if (words.length === 1) {
    const word = words[0];
    if (word.length > 7) {
      const midpoint = Math.ceil(word.length / 2);
      return [word.slice(0, midpoint), word.slice(midpoint)];
    }
    return [word];
  }
  return words;
}

// Start the animation with initial words from the URL hash
const initialWords = getWordsFromHash();
if (initialWords.length > 0) {
  eventLoop.addFrames(init(initialWords));
  eventLoop.start();
} else {
  eventLoop.addFrames(init(["Hello"])); // Default words
  eventLoop.start();
}

let isTransitioning = false;

window.addEventListener("hashchange", () => {
  const newWords = getWordsFromHash();
  if (newWords.length > 0) {
    isTransitioning = true;
    const currentFrame = eventLoop.lastFrame().slice(0, -1); // Remove last row
    const newFrame = init(newWords)[0];
    const interpolatedFrames = interpolateFramesApproximateOT(
      currentFrame,
      newFrame,
      TRANSITION_FRAMES
    );

    // Add toolbar row back to each interpolated frame
    const toolbarRow = eventLoop.lastFrame()[eventLoop.lastFrame().length - 1];
    const framesWithToolbar = interpolatedFrames.map((frame) => [
      ...frame,
      toolbarRow,
    ]);

    eventLoop.addFrames(framesWithToolbar);
  }
});

// scroll wheel
let scrollTimeout: number | null = null;

const SCROLL_SPEED = 1.5;
let lastScrollTime = 0;

window.addEventListener("wheel", (event: WheelEvent) => {
  if (isTransitioning) {
    return; // Ignore scroll events during transitions
  }

  const currentTime = performance.now();
  if (currentTime - lastScrollTime < 1000 / FPS) {
    return; // Throttle to FPS
  }
  lastScrollTime = currentTime;

  // Apply the scroll to each letter
  for (const letter of lastWords!.letters) {
    letter.layer.offset_x += SCROLL_SPEED * letter.dx * Math.sign(event.deltaY);
    letter.layer.offset_y += SCROLL_SPEED * letter.dy * Math.sign(event.deltaY);
  }

  // Add a new frame if there are no remaining frames
  if (eventLoop.numRemainingFrames() < 2) {
    eventLoop.addFrame(lastCanvas!.getFrame());
  }

  // Clear any existing timeout
  if (scrollTimeout !== null) {
    clearTimeout(scrollTimeout);
  }
});
