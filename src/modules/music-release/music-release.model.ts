import { Schema, model, Document, Types } from 'mongoose';
import { MUSIC_RELEASE_STATUS, type MusicReleaseStatus } from './music-release.constants';

export interface IReleaseTrack {
  title: string;
  artist: string;
  lyrics: string;
  isrcOption: 'own' | 'generate';
  isrc: string;
  composer: string;
  producer: string;
  director: string;
  language: string;
  genre: string;
  subGenre: string;
  price: 'budget' | 'back' | 'mid' | 'front' | 'premium';
}

export interface IReleaseAudioFile {
  fileName: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface IReleaseCrbtEntry {
  title: string;
  startTime: string;
}

export interface IMusicRelease extends Document {
  _id: Types.ObjectId;
  title: string;
  version: string;
  artist: string;
  releaseType: 'single' | 'ep' | 'album';
  releasingDate: string;
  label: string;
  instrumental: 'yes' | 'no';
  explicit: 'yes' | 'no';
  aiGenerated: 'yes' | 'no';
  upc: string;
  pLine: string;
  cLine: string;
  coverArtUrl: string;
  audioFiles: IReleaseAudioFile[];
  tracks: IReleaseTrack[];
  crbtEntries: IReleaseCrbtEntry[];
  scheduledReleaseDate: string;
  scheduleNotes: string;
  releasePlatform:
    | 'all-excluding-youtube'
    | 'all-including-youtube'
    | 'only-youtube'
    | 'only-meta-audio';
  status: MusicReleaseStatus;
  correctionReasons?: string[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const trackSchema = new Schema<IReleaseTrack>(
  {
    title: { type: String, default: '' },
    artist: { type: String, default: '' },
    lyrics: { type: String, default: '' },
    isrcOption: { type: String, enum: ['own', 'generate'], default: 'generate' },
    isrc: { type: String, default: '' },
    composer: { type: String, default: '' },
    producer: { type: String, default: '' },
    director: { type: String, default: '' },
    language: { type: String, default: '' },
    genre: { type: String, default: '' },
    subGenre: { type: String, default: '' },
    price: {
      type: String,
      enum: ['budget', 'back', 'mid', 'front', 'premium'],
      default: 'mid',
    },
  },
  { _id: false },
);

const audioFileSchema = new Schema<IReleaseAudioFile>(
  {
    fileName: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    sizeBytes: { type: Number },
  },
  { _id: false },
);

const crbtSchema = new Schema<IReleaseCrbtEntry>(
  {
    title: { type: String, default: '' },
    startTime: { type: String, default: '' },
  },
  { _id: false },
);

const musicReleaseSchema = new Schema<IMusicRelease>(
  {
    title: { type: String, required: true, trim: true, index: true },
    version: { type: String, default: '', trim: true },
    artist: { type: String, required: true, trim: true, index: true },
    releaseType: { type: String, enum: ['single', 'ep', 'album'], required: true },
    releasingDate: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    instrumental: { type: String, enum: ['yes', 'no'], default: 'no' },
    explicit: { type: String, enum: ['yes', 'no'], default: 'no' },
    aiGenerated: { type: String, enum: ['yes', 'no'], default: 'no' },
    upc: { type: String, default: '' },
    pLine: { type: String, default: '' },
    cLine: { type: String, default: '' },
    coverArtUrl: { type: String, default: '' },
    audioFiles: { type: [audioFileSchema], default: [] },
    tracks: { type: [trackSchema], default: [] },
    crbtEntries: { type: [crbtSchema], default: [] },
    scheduledReleaseDate: { type: String, required: true },
    scheduleNotes: { type: String, default: '' },
    releasePlatform: {
      type: String,
      enum: ['all-excluding-youtube', 'all-including-youtube', 'only-youtube', 'only-meta-audio'],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(MUSIC_RELEASE_STATUS),
      default: MUSIC_RELEASE_STATUS.IN_REVIEW,
      index: true,
    },
    correctionReasons: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const MusicReleaseModel = model<IMusicRelease>('MusicRelease', musicReleaseSchema);
