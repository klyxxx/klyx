export class CameraUnavailableError extends Error {
  constructor() {
    super("Camera API unavailable");
    this.name = "CameraUnavailableError";
  }
}

export function isCameraPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "NotAllowedError"
  );
}

export async function requestEnvironmentCamera(
  mediaDevices?: Pick<MediaDevices, "getUserMedia">
): Promise<MediaStream> {
  if (!mediaDevices?.getUserMedia) {
    throw new CameraUnavailableError();
  }

  return mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
    },
  });
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function disposeCameraSession(
  stream: MediaStream | null | undefined,
  video?: HTMLVideoElement | null
): void {
  stopMediaStream(stream);

  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

export function captureVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  afterFrameCaptured?: () => void
): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) {
    return Promise.reject(new Error("Camera frame unavailable"));
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    return Promise.reject(new Error("Canvas unavailable"));
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  afterFrameCaptured?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Camera capture unavailable"));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}
