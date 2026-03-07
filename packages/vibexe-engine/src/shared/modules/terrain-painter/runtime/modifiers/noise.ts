/**
 * Noise Modifier — Paints using procedural noise patterns
 * Converted from Unity Noise.cs
 *
 * Two noise types:
 * - Simplex: 3-octave fBm value noise (organic)
 * - Gradient: Grid-based gradient noise (structured)
 *
 * Used to break up repetition and add organic variation.
 */
import {
	FilterPass,
	Modifier,
	type ModifierUniforms,
} from "../modifier";

export enum NoiseType {
	Simplex = 0,
	Gradient = 1,
}

export class NoiseModifier extends Modifier {
	passIndex = FilterPass.Noise;
	noiseType = NoiseType.Simplex;
	noiseScale = 50;
	noiseOffsetX = 0;
	noiseOffsetY = 0;
	levelMin = 0.5;
	levelMax = 1.0;

	configure(uniforms: ModifierUniforms): void {
		super.configure(uniforms);
		uniforms.u_noiseScaleOffset = {
			value: [
				this.noiseScale * 0.001,
				this.noiseScale * 0.001,
				this.noiseOffsetX,
				this.noiseOffsetY,
			],
		};
		uniforms.u_levels = {
			value: [this.levelMin, this.levelMax, 0, 0],
		};
		uniforms.u_noiseType = { value: this.noiseType };
	}

	toJSON() {
		return {
			...super.toJSON(),
			noiseType: this.noiseType,
			noiseScale: this.noiseScale,
			noiseOffsetX: this.noiseOffsetX,
			noiseOffsetY: this.noiseOffsetY,
			levelMin: this.levelMin,
			levelMax: this.levelMax,
		};
	}

	fromJSON(data: Record<string, unknown>) {
		super.fromJSON(data);
		if (data.noiseType !== undefined) this.noiseType = data.noiseType as NoiseType;
		if (data.noiseScale !== undefined) this.noiseScale = data.noiseScale as number;
		if (data.noiseOffsetX !== undefined) this.noiseOffsetX = data.noiseOffsetX as number;
		if (data.noiseOffsetY !== undefined) this.noiseOffsetY = data.noiseOffsetY as number;
		if (data.levelMin !== undefined) this.levelMin = data.levelMin as number;
		if (data.levelMax !== undefined) this.levelMax = data.levelMax as number;
	}
}
