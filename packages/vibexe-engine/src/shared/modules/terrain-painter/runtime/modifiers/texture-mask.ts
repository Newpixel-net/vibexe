/**
 * TextureMask Modifier — Paints using an external texture as mask
 * Converted from Unity TextureMask.cs
 *
 * Uses a grayscale (or single channel) texture to control painting.
 * Can span across multiple terrains or tile per-terrain.
 */
import {
	FilterPass,
	Modifier,
	type ModifierUniforms,
} from "../modifier";

export class TextureMaskModifier extends Modifier {
	passIndex = FilterPass.TextureMask;
	/** URL or path to the mask texture */
	textureUrl = "";
	/** Which RGBA channel to sample: 0=R, 1=G, 2=B, 3=A */
	channel = 0;
	/** Whether to span the texture across all terrains */
	spanTerrains = false;
	/** Texture tiling factor */
	tiling = 1;

	/** Set by the runtime when texture is loaded */
	_textureObject: unknown = null;

	configure(uniforms: ModifierUniforms): void {
		super.configure(uniforms);
		if (this._textureObject) {
			uniforms.u_maskTexture = { value: this._textureObject };
		}
		uniforms.u_tilingParams = {
			value: [this.tiling, this.spanTerrains ? 1 : 0],
		};
		uniforms.u_channel = { value: this.channel };
	}

	toJSON() {
		return {
			...super.toJSON(),
			textureUrl: this.textureUrl,
			channel: this.channel,
			spanTerrains: this.spanTerrains,
			tiling: this.tiling,
		};
	}

	fromJSON(data: Record<string, unknown>) {
		super.fromJSON(data);
		if (data.textureUrl !== undefined) this.textureUrl = data.textureUrl as string;
		if (data.channel !== undefined) this.channel = data.channel as number;
		if (data.spanTerrains !== undefined) this.spanTerrains = data.spanTerrains as boolean;
		if (data.tiling !== undefined) this.tiling = data.tiling as number;
	}
}
