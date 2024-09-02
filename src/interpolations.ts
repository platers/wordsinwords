type Point = { row: number; col: number };

function generateFlipTimes(
  rows: number,
  cols: number,
  steps: number
): number[][] {
  const flipTimes: number[][] = [];
  for (let i = 0; i < rows; i++) {
    flipTimes.push(Array(cols).fill(0));
    for (let j = 0; j < cols; j++) {
      flipTimes[i][j] = Math.floor(Math.random() * steps);
    }
  }
  return flipTimes;
}

function initializeFrame(rows: number, cols: number): string[][] {
  return Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(" "));
}

export function interpolateFramesRandomFlip(
  frame1: string[][],
  frame2: string[][],
  steps: number
): string[][][] {
  const frames: string[][][] = [];
  const rows = frame1.length;
  const cols = frame1[0].length;
  const flipTimes = generateFlipTimes(rows, cols, steps);

  for (let step = 0; step <= steps; step++) {
    const frame = initializeFrame(rows, cols);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const char1 = frame1[row][col];
        const char2 = frame2[row][col];
        frame[row][col] = step < flipTimes[row][col] ? char1 : char2;
      }
    }

    frames.push(frame);
  }

  return frames;
}

function getPixelLocations(frame: string[][]): { row: number; col: number }[] {
  const pixels: { row: number; col: number }[] = [];
  for (let row = 0; row < frame.length; row++) {
    for (let col = 0; col < frame[0].length; col++) {
      if (frame[row][col] !== " ") {
        pixels.push({ row, col });
      }
    }
  }
  return pixels;
}

export function interpolateFramesRandomMap(
  frame1: string[][],
  frame2: string[][],
  steps: number
): string[][][] {
  const frames: string[][][] = [];
  const rows = frame1.length;
  const cols = frame1[0].length;

  const sourcePixels = getPixelLocations(frame1);
  const targetPixels = getPixelLocations(frame2);

  while (sourcePixels.length < targetPixels.length) {
    sourcePixels.push(
      sourcePixels[Math.floor(Math.random() * sourcePixels.length)]
    );
  }
  while (targetPixels.length < sourcePixels.length) {
    targetPixels.push(
      targetPixels[Math.floor(Math.random() * targetPixels.length)]
    );
  }

  for (let step = 0; step <= steps; step++) {
    const frame = initializeFrame(rows, cols);

    for (let i = 0; i < sourcePixels.length; i++) {
      const source = sourcePixels[i];
      const target = targetPixels[i];
      const tRow = source.row + ((target.row - source.row) * step) / steps;
      const tCol = source.col + ((target.col - source.col) * step) / steps;

      frame[Math.floor(tRow)][Math.floor(tCol)] =
        frame2[target.row][target.col];
    }

    frames.push(frame);
  }

  return frames;
}
class PointCloud {
  public points: { row: number; col: number }[] = [];
  public centerOfMass: { row: number; col: number } = { row: 0, col: 0 };
  public totalPoints: number = 0;
  private sum: { row: number; col: number } = { row: 0, col: 0 };

  constructor(points: { row: number; col: number }[]) {
    this.points = points;
    this.totalPoints = points.length;
    this.sum = points.reduce(
      (acc, point) => {
        acc.row += point.row;
        acc.col += point.col;
        return acc;
      },
      { row: 0, col: 0 }
    );
    this.updateCenterOfMass();
  }

  private updateCenterOfMass(): void {
    if (this.totalPoints === 0) {
      this.centerOfMass = { row: 0, col: 0 };
      return;
    }

    this.centerOfMass = {
      row: this.sum.row / this.totalPoints,
      col: this.sum.col / this.totalPoints,
    };
  }

  public removePoint(point: { row: number; col: number }): void {
    const index = this.points.findIndex(
      (p) => p.row === point.row && p.col === point.col
    );
    if (index !== -1) {
      this.points.splice(index, 1);
      this.sum.row -= point.row;
      this.sum.col -= point.col;
      this.totalPoints--;
      this.updateCenterOfMass();
    }
  }

  public findClosestPoint(target: { row: number; col: number }): {
    row: number;
    col: number;
  } {
    let closestPoint: { row: number; col: number } | null = null;
    let minDistance = Infinity;

    for (const point of this.points) {
      const distance = Math.sqrt(
        Math.pow(point.row - target.row, 2) +
          Math.pow(point.col - target.col, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }
    console.assert(closestPoint !== null, "No closest point found");
    return closestPoint!;
  }

  public findFarthestPointFromCOM(): { row: number; col: number } {
    let farthestPoint: { row: number; col: number } | null = null;
    let maxDistance = -Infinity;

    for (const point of this.points) {
      const distance = Math.sqrt(
        Math.pow(point.row - this.centerOfMass.row, 2) +
          Math.pow(point.col - this.centerOfMass.col, 2)
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        farthestPoint = point;
      }
    }
    console.assert(farthestPoint !== null, "No farthest point found");
    return farthestPoint!;
  }
}

function approximateOT(
  sourcePixels: Point[],
  targetPixels: Point[]
): {
  sourcePixels: Point[];
  targetPixels: Point[];
} {
  //   return { sourcePixels, targetPixels };
  const sourceCloud = new PointCloud(sourcePixels);
  const targetCloud = new PointCloud(targetPixels);

  const newSourcePixels: Point[] = [];
  const newTargetPixels: Point[] = [];

  while (targetCloud.points.length > 0) {
    const farthestTarget = targetCloud.findFarthestPointFromCOM();
    const closestSource = sourceCloud.findClosestPoint(farthestTarget);

    newSourcePixels.push(closestSource);
    newTargetPixels.push(farthestTarget);

    sourceCloud.removePoint(closestSource);
    targetCloud.removePoint(farthestTarget);
  }
  console.assert(
    newSourcePixels.length === newTargetPixels.length,
    "Source and target pixel arrays must have the same length"
  );

  return { sourcePixels: newSourcePixels, targetPixels: newTargetPixels };
}
export function interpolateFramesApproximateOT(
  frame1: string[][],
  frame2: string[][],
  steps: number
): string[][][] {
  const frames: string[][][] = [];
  const rows = frame1.length;
  const cols = frame1[0].length;

  let sourcePixels = getPixelLocations(frame1);
  let targetPixels = getPixelLocations(frame2);
  const numSourcePixels = sourcePixels.length;
  const numTargetPixels = targetPixels.length;

  // Make sure the source and target pixels have the same length
  while (sourcePixels.length < targetPixels.length) {
    sourcePixels.push(
      sourcePixels[Math.floor(Math.random() * numSourcePixels)]
    );
  }
  while (targetPixels.length < sourcePixels.length) {
    targetPixels.push(
      targetPixels[Math.floor(Math.random() * numTargetPixels)]
    );
  }

  const { sourcePixels: newSourcePixels, targetPixels: newTargetPixels } =
    approximateOT(sourcePixels, targetPixels);

  for (let step = 0; step <= steps; step++) {
    const frame = initializeFrame(rows, cols);

    for (let i = 0; i < newSourcePixels.length; i++) {
      const source = newSourcePixels[i];
      const target = newTargetPixels[i];
      const tRow = source.row + ((target.row - source.row) * step) / steps;
      const tCol = source.col + ((target.col - source.col) * step) / steps;

      frame[Math.floor(tRow)][Math.floor(tCol)] = String.fromCharCode(
        33 + Math.floor(Math.random() * 94)
      ); // Random ASCII character
    }

    frames.push(frame);
  }

  return frames;
}
