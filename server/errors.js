// An error whose message is safe to show the person, with its HTTP status.
export class StudioError extends Error{constructor(message,status=400){super(message);this.status=status;}}
