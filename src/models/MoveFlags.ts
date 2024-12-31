export interface MoveFlags {
    isCapture?: boolean;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isSelf?: boolean;
    isCastling?: boolean;
    isPromotion?: boolean;
}