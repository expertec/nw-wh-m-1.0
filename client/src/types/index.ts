// types/index.ts - Tipos compartidos del CRM

export interface Lead {
  id: string;
  telefono: string;
  nombre: string;
  jid: string;
  resolvedJid?: string;
  lidJid?: string;
  addressingMode?: string;
  source?: string;
  estado: string;
  etiquetas: string[];
  etapa?: string;
  lastMessageAt: Date | null;
  fecha_creacion?: Date | null;
  unreadCount: number;
  hasActiveSequences: boolean;
  seqPaused: boolean;
  stopSequences?: boolean;
  secuenciasActivas: SequenceActive[];
  sequenceSentSteps?: Record<string, unknown>;
  nextSequenceRunAt?: Date | null;
}

export interface SequenceActive {
  trigger: string;
  startTime: string;
  index: number;
  completed: boolean;
}

export interface Message {
  id: string;
  content: string;
  mediaType: 'text' | 'image' | 'audio' | 'video' | 'video_note' | 'audio_ptt' | 'document' | 'unknown';
  mediaUrl: string | null;
  sender: 'lead' | 'business' | 'system';
  timestamp: Date;
}

export interface Sequence {
  id: string;
  trigger: string;
  active: boolean;
  messages: SequenceStep[];
}

export interface SequenceStep {
  type: 'texto' | 'imagen' | 'audio' | 'video' | 'videonota' | 'formulario';
  contenido: string;
  delay: number;
  caption?: string;
  seconds?: number;
  ptt?: boolean;
}

export interface Tenant {
  id: string;
  nombre: string;
  plan: string;
  ownerEmail: string | null;
  disabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TenantConfig {
  defaultTrigger?: string;
  defaultTriggerMetaAds?: string;
  [key: string]: unknown;
}

export interface HashtagConfig {
  hashtagMap: Record<string, string>;
  cancelByTrigger: Record<string, string[]>;
  updatedAt?: Date;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: 'superadmin' | 'admin' | 'agent';
  tenantId: string;
}
