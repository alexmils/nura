import type { Metadata } from "next";
import {
  ModePickDemo,
  NoColdStartDemo,
  SafePlaceDemo,
} from "@/app/components/frontend/GroundFirstTutorial";

export const metadata: Metadata = {
  title: "Ground first demos",
  robots: { index: false, follow: false },
};

/** Stacked preview of the three independent Ground first demos. */
export default function GroundMockPage() {
  return (
    <div className="gft-dev-page">
      <div className="gft-dev-block">
        <p className="gft-dev-label">1 · Mode pick (cursor)</p>
        <div className="gft-dev-frame">
          <ModePickDemo forcePlay />
        </div>
      </div>
      <div className="gft-dev-block">
        <p className="gft-dev-label">2 · Safe place first (no cursor)</p>
        <div className="gft-dev-frame gft-dev-frame--card">
          <SafePlaceDemo forcePlay />
        </div>
      </div>
      <div className="gft-dev-block">
        <p className="gft-dev-label">3 · No cold starts (no cursor)</p>
        <div className="gft-dev-frame gft-dev-frame--card">
          <NoColdStartDemo forcePlay />
        </div>
      </div>
    </div>
  );
}
