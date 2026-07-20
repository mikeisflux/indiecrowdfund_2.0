import Image from "next/image";
import { Play } from "lucide-react";

interface Props {
  videoUrl: string;
  imageUrl?: string | null;
  title: string;
}

// Renders a project campaign video inline. YouTube/Vimeo embed with fullscreen;
// a direct/uploaded file plays in an HTML5 <video> with native controls
// (play/pause, volume, fullscreen). Only a truly un-embeddable external URL
// falls back to opening in a new tab. Fills its (aspect-video) container.
export function ProjectVideoPlayer({ videoUrl, imageUrl, title }: Props) {
  const youtubeMatch = videoUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  const vimeoMatch = videoUrl.match(/(?:vimeo\.com\/)(\d+)/);

  if (youtubeMatch) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0`}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={title}
      />
    );
  }

  if (vimeoMatch) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title}
      />
    );
  }

  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(videoUrl)) {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        poster={imageUrl || undefined}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      >
        <source src={videoUrl} />
        Your browser doesn&apos;t support embedded video.
      </video>
    );
  }

  return (
    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
          unoptimized={imageUrl.endsWith(".gif")}
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90">
          <Play className="ml-1 h-8 w-8 text-gray-900" />
        </div>
      </div>
    </a>
  );
}
