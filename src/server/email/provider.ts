import "server-only";
export interface EmailMessage { to: string; subject: string; html: string; text: string }
export interface EmailProvider { send(msg: EmailMessage): Promise<{ messageId?: string }> }
