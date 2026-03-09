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
	/** URL to the normal map (optional — auto-derived from diffuseUrl if omitted) */
	normalUrl?: string;
	/** URL to roughness map (optional — auto-derived from diffuseUrl if omitted) */
	roughnessUrl?: string;
	/** URL to emission map (optional — for emissive materials like Lava/Burnt) */
	emissionUrl?: string;
	/** Emission intensity multiplier. Default 0 (no emission) */
	emissionIntensity?: number;
	/** Per-layer roughness (0.0 = mirror, 1.0 = fully rough). Default 0.8 */
	roughness?: number;
	/** Texture tiling scale */
	tiling: number;
	/** Preview color for the UI swatch */
	previewColor: string;
	/** Reference to terrain material catalog entry ID */
	materialId?: string;
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
