import { describe, expect, it, vi } from "vitest";

import {
  CameraUnavailableError,
  captureVideoFrame,
  disposeCameraSession,
  requestEnvironmentCamera,
  stopMediaStream,
} from "@/lib/photo-camera";

describe("photo camera lifecycle", () => {
  it("falls back cleanly when the camera API is absent", async () => {
    await expect(requestEnvironmentCamera(undefined)).rejects.toBeInstanceOf(
      CameraUnavailableError
    );
  });

  it("surfaces a denied camera permission without retaining a stream", async () => {
    const denied = new DOMException("Permission denied", "NotAllowedError");
    const getUserMedia = vi.fn().mockRejectedValue(denied);

    await expect(
      requestEnvironmentCamera({ getUserMedia } as Pick<MediaDevices, "getUserMedia">)
    ).rejects.toBe(denied);

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  });

  it("stops every MediaStream track", () => {
    const stopVideo = vi.fn();
    const stopAudio = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopVideo }, { stop: stopAudio }],
    } as unknown as MediaStream;

    stopMediaStream(stream);

    expect(stopVideo).toHaveBeenCalledOnce();
    expect(stopAudio).toHaveBeenCalledOnce();
  });

  it("captures one frame successfully and runs cleanup before JPEG encoding", async () => {
    const drawImage = vi.fn();
    const afterFrameCaptured = vi.fn();
    const blob = new Blob(["frame"], { type: "image/jpeg" });
    const video = {
      videoWidth: 1280,
      videoHeight: 720,
    } as HTMLVideoElement;
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback) => {
        expect(afterFrameCaptured).toHaveBeenCalledOnce();
        callback(blob);
      }),
    } as unknown as HTMLCanvasElement;

    await expect(
      captureVideoFrame(video, canvas, afterFrameCaptured)
    ).resolves.toBe(blob);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
  });

  it("cancels a camera session by stopping tracks and detaching video", () => {
    const stop = vi.fn();
    const pause = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const video = {
      pause,
      srcObject: stream,
    } as unknown as HTMLVideoElement;

    disposeCameraSession(stream, video);

    expect(stop).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
});
