/**
 * Direction Modifier — Paints based on surface facing direction
 * Converted from Unity Direction.cs
 *
 * Surfaces facing a specific direction get painted.
 * Example: sun-facing slopes get different texture than shadow sides.
 */
import {
	FilterPass,
	Modifier,
	type ModifierUniforms,
} from "../modifier";

export class DirectionModifier extends Modifier {
	passIndex = FilterPass.Direction;
	xAngle = 45; // 0-90 degrees
	yAngle = 0; // 0-360 degrees
	levelMin = 0;
	levelMax = 1;

	configure(uniforms: ModifierUniforms): void {
		super.configure(uniforms);

		// Convert Euler angles to direction vector (matches Unity Quaternion.Euler * Vector3.forward)
		const xRad = (this.xAngle * Math.PI) / 180;
		const yRad = (this.yAngle * Math.PI) / 180;
		const dir = [
			Math.sin(yRad) * Math.cos(xRad),
			Math.sin(xRad),
			Math.cos(yRad) * Math.cos(xRad),
		];

		uniforms.u_direction = { value: dir };
		uniforms.u_directionLevels = {
			value: [this.levelMin, this.levelMax, 0, 0],
		};
	}

	toJSON() {
		return {
			...super.toJSON(),
			xAngle: this.xAngle,
			yAngle: this.yAngle,
			levelMin: this.levelMin,
			levelMax: this.levelMax,
		};
	}

	fromJSON(data: Record<string, unknown>) {
		super.fromJSON(data);
		if (data.xAngle !== undefined) this.xAngle = data.xAngle as number;
		if (data.yAngle !== undefined) this.yAngle = data.yAngle as number;
		if (data.levelMin !== undefined) this.levelMin = data.levelMin as number;
		if (data.levelMax !== undefined) this.levelMax = data.levelMax as number;
	}
}
