/**
 * Slope Modifier — Paints based on terrain slope angle
 * Converted from Unity Slope.cs
 *
 * Textures appear on surfaces within a slope angle range.
 * Example: rock on steep cliffs (45-90 deg), grass on flat areas (0-30 deg)
 */
import {
	FilterPass,
	Modifier,
	type ModifierUniforms,
} from "../modifier";

export class SlopeModifier extends Modifier {
	passIndex = FilterPass.Slope;
	minAngle = 0; // degrees
	maxAngle = 90; // degrees
	minFalloff = 10;
	maxFalloff = 10;

	configure(uniforms: ModifierUniforms): void {
		super.configure(uniforms);
		uniforms.u_minMaxSlope = {
			value: [this.minAngle, this.maxAngle, this.minFalloff, this.maxFalloff],
		};
	}

	toJSON() {
		return {
			...super.toJSON(),
			minAngle: this.minAngle,
			maxAngle: this.maxAngle,
			minFalloff: this.minFalloff,
			maxFalloff: this.maxFalloff,
		};
	}

	fromJSON(data: Record<string, unknown>) {
		super.fromJSON(data);
		if (data.minAngle !== undefined) this.minAngle = data.minAngle as number;
		if (data.maxAngle !== undefined) this.maxAngle = data.maxAngle as number;
		if (data.minFalloff !== undefined) this.minFalloff = data.minFalloff as number;
		if (data.maxFalloff !== undefined) this.maxFalloff = data.maxFalloff as number;
	}
}
