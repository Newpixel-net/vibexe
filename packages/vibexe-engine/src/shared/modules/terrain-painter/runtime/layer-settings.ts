/**
 * LayerSettings — Configuration for a single terrain texture layer
 * Converted from Unity LayerSettings.cs
 *
 * Each layer has:
 * - A diffuse texture (what gets painted on the terrain)
 * - An enabled flag
 * - A modifier stack (filters that control WHERE this texture appears)
 */
import type { Modifier } from "./modifier";

export interface LayerTexture {
	/** Display name (e.g. "Snow", "Grass", "Rock") */
	name: string;
	/** URL to the diffuse texture image */
	diffuseUrl: string;
	/** URL to the normal map (optional) */
	normalUrl?: string;
	/** Texture tiling scale */
	tiling: number;
	/** Preview color for the UI swatch */
	previewColor: string;
}

export class LayerSettings {
	enabled = true;
	texture: LayerTexture;
	modifierStack: Modifier[] = [];

	constructor(texture: LayerTexture) {
		this.texture = texture;
	}

	toJSON(): Record<string, unknown> {
		return {
			enabled: this.enabled,
			texture: this.texture,
			modifierStack: this.modifierStack.map((m) => m.toJSON()),
		};
	}
}
