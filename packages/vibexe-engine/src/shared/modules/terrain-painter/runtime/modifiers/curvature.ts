/**
 * Curvature Modifier — Paints based on surface curvature
 * Converted from Unity Curvature.cs
 *
 * Two solver modes:
 * - Soft: overlay blend of normal deltas (smoother)
 * - Hard: cross product of normal neighbors (sharper edges)
 *
 * Example: dirt in concave crevices, moss on convex ridges
 */
import {
	FilterPass,
	Modifier,
	type ModifierUniforms,
} from "../modifier";

export enum CurvatureSolver {
	Soft = 0,
	Hard = 1,
}

export class CurvatureModifier extends Modifier {
	passIndex = FilterPass.Curvature;
	solver = CurvatureSolver.Soft;
	minCurvature = 0;
	maxCurvature = 0.25;
	radius = 1; // 1-16
	minFalloff = 0.001;
	maxFalloff = 0.001;

	configure(uniforms: ModifierUniforms): void {
		super.configure(uniforms);
		uniforms.u_curvatureSolver = { value: this.solver };
		uniforms.u_curvatureRadius = { value: this.radius };
		uniforms.u_minMaxCurvature = {
			value: [
				this.minCurvature,
				this.maxCurvature,
				this.minFalloff,
				this.maxFalloff,
			],
		};
	}

	toJSON() {
		return {
			...super.toJSON(),
			solver: this.solver,
			minCurvature: this.minCurvature,
			maxCurvature: this.maxCurvature,
			radius: this.radius,
			minFalloff: this.minFalloff,
			maxFalloff: this.maxFalloff,
		};
	}

	fromJSON(data: Record<string, unknown>) {
		super.fromJSON(data);
		if (data.solver !== undefined) this.solver = data.solver as CurvatureSolver;
		if (data.minCurvature !== undefined) this.minCurvature = data.minCurvature as number;
		if (data.maxCurvature !== undefined) this.maxCurvature = data.maxCurvature as number;
		if (data.radius !== undefined) this.radius = data.radius as number;
		if (data.minFalloff !== undefined) this.minFalloff = data.minFalloff as number;
		if (data.maxFalloff !== undefined) this.maxFalloff = data.maxFalloff as number;
	}
}
