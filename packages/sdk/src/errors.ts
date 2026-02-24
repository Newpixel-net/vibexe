export class VibexeSdkError extends Error {
	name = "VibexeSdkError";
}

export class ConfigurationError extends VibexeSdkError {
	name = "ConfigurationError";
}

export class ApiError extends VibexeSdkError {
	name = "ApiError";

	constructor(
		message: string,
		public readonly status: number,
		public readonly responseText: string,
	) {
		super(message);
	}
}

export class UnsupportedFeatureError extends VibexeSdkError {
	name = "UnsupportedFeatureError";
}

export class NotImplementedError extends VibexeSdkError {
	name = "NotImplementedError";
}

export class TimeoutError extends VibexeSdkError {
	name = "TimeoutError";
}
