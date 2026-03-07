/**
 * Height Modifier — Paints based on terrain height
 * Converted from Unity Height.cs
 *
 * Textures appear between min and max height with configurable falloff.
 * Example: snow above 100m, sand below 10m
 */
import {
	FilterPass,
	Modifier,
	type ModifierUniforms,
} from "../modifier";

export class HeightModifier extends Modifier {
	passIndex = FilterPass.Height;
	min = 0;
	minFalloff = 1;
	max = 2000;
	maxFalloff = 1;

	configure(uniforms: ModifierUniforms): void {
		super.configure(uniforms);
		uniforms.u_minMaxHeight = {
			value: [this.min, this.max, this.minFalloff, this.maxFalloff],
		};
	}

	toJSON() {
		return {
			...super.toJSON(),
			min: this.min,
			max: this.max,
			minFalloff: this.minFalloff,
			maxFalloff: this.maxFalloff,
		};
	}

	fromJSON(data: Record<string, unknown>) {
		super.fromJSON(data);
		if (data.min !== undefined) this.min = data.min as number;
		if (data.max !== undefined) this.max = data.max as number;
		if (data.minFalloff !== undefined)
			this.minFalloff = data.minFalloff as number;
		if (data.maxFalloff !== undefined)
			this.maxFalloff = data.maxFalloff as number;
	}
}
