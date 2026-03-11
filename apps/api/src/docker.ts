import Docker from "dockerode";
import { config } from "./config.js";

export const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export type PlaygroundContainer = {
  containerId: string;
  volumeName: string;
};

export async function ensureImage(image: string): Promise<void> {
  // Best-effort: if the image isn't present, try to pull it.
  try {
    await docker.getImage(image).inspect();
    return;
  } catch {
    // continue
  }

  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e: any) => (e ? reject(e) : resolve()));
    });
  });
}

export async function createPlaygroundContainer(sessionId: string): Promise<PlaygroundContainer> {
  const image = config.playground.image;
  await ensureImage(image);

  const volumeName = `linuxpg_${sessionId.replace(/[^a-zA-Z0-9_.-]/g, "")}`;
  await docker.createVolume({ Name: volumeName, Labels: { "linux-playground": "1", sessionId } });

  const memoryBytes = Math.max(64, config.playground.memoryMb) * 1024 * 1024;

  const container = await docker.createContainer({
    Image: image,
    Cmd: ["/bin/bash"],
    Tty: true,
    OpenStdin: true,
    StdinOnce: false,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    WorkingDir: "/workspace",
    User: "1000:1000",
    Labels: { "linux-playground": "1", sessionId },
    HostConfig: {
      AutoRemove: false,
      CapDrop: ["ALL"],
      NetworkMode: "bridge",
      PidsLimit: 128,
      Memory: memoryBytes,
      NanoCpus: config.playground.nanoCpus,
      SecurityOpt: ["no-new-privileges"],
      Tmpfs: {
        "/tmp": "rw,noexec,nosuid,size=64m"
      },
      Mounts: [
        {
          Type: "volume",
          Source: volumeName,
          Target: "/workspace"
        }
      ]
    }
  });

  await container.start();

  return { containerId: container.id, volumeName };
}

export async function destroyPlaygroundContainer(containerId: string | null, volumeName: string | null) {
  if (containerId) {
    try {
      const c = docker.getContainer(containerId);
      try {
        await c.stop({ t: 2 });
      } catch {
        // ignore
      }
      await c.remove({ force: true });
    } catch {
      // ignore
    }
  }

  if (volumeName) {
    try {
      await docker.getVolume(volumeName).remove({ force: true } as any);
    } catch {
      // ignore
    }
  }
}

