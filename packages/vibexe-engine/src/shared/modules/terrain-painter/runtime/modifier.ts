/**
 * Modifier — Base class for terrain painting filters
 * Converted from Unity Modifier.cs
 *
 * Each modifier generates a grayscale mask via a GPU shader pass.
 * Modifiers are stacked per layer and composited with blend modes.
 */

export enum FilterPass {
	Height = 0,
	Slope = 1,
	Curvature = 2,
	TextureMask = 3,
	Noise = 4,
	Direction = 5,
}

export enum BlendMode {
	Multiply = "Multiply",
	Add = "Add",
	Subtract = "Subtract",
	Min = "Min",
	Max = "Max",
}

/** Maps BlendMode to the GPU blend operation integer used in shaders */
export function blendModeToOp(mode: BlendMode): number {
	switch (mode) {
		case BlendMode.Multiply:
			return 21;
		case BlendMode.Add:
			return 0;
		case BlendMode.Subtract:
			return 2;
		case BlendMode.Min:
			return 3;
		case BlendMode.Max:
			return 4;
	}
}

export interface ModifierConfig {
	enabled: boolean;
	label: string;
	blendMode: BlendMode;
	opacity: number; // 0-100
	passIndex: FilterPass;
}

export interface ModifierUniforms {
	[key: string]: { value: unknown };
}

/**
 * Base Modifier class — subclasses override configure() to set pass-specific uniforms
 */
export abstract class Modifier {
	enabled = true;
	label = "";
	blendMode = BlendMode.Multiply;
	opacity = 100;
	abstract passIndex: FilterPass;

	/** Set uniforms on the shader material. Base sets blend mode + opacity. */
	configure(uniforms: ModifierUniforms): void {
		uniforms.u_opacity = { value: this.opacity * 0.01 };
		uniforms.u_blendOp = { value: blendModeToOp(this.blendMode) };
	}

	/** Serialize to JSON for persistence */
	toJSON(): Record<string, unknown> {
		return {
			type: this.constructor.name,
			enabled: this.enabled,
			label: this.label,
			blendMode: this.blendMode,
			opacity: this.opacity,
		};
	}

	/** Restore from JSON */
	fromJSON(data: Record<string, unknown>): void {
		if (data.enabled !== undefined) this.enabled = data.enabled as boolean;
		if (data.label !== undefined) this.label = data.label as string;
		if (data.blendMode !== undefined)
			this.blendMode = data.blendMode as BlendMode;
		if (data.opacity !== undefined) this.opacity = data.opacity as number;
	}
}
