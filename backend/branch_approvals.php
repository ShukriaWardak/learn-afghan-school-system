<?php
declare(strict_types=1);

// Review versions detect changes to the branch fields shown to a reviewer.
// This fingerprint is concurrency metadata, not authentication or a CSRF token.
function branchReviewFields(array $row): array {
    return [
        'id'=>(int)$row['id'],'code'=>$row['code'],'name'=>$row['name'],
        'zone_id'=>(int)$row['zone_id'],'location'=>$row['location'],
        'status'=>$row['status'],'created_at'=>$row['created_at'],'updated_at'=>$row['updated_at'],
    ];
}
function branchReviewVersion(array $row): string {
    return hash('sha256',json_encode(branchReviewFields($row),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
}
function pendingBranchReview(array $row): array {
    return branchReviewFields($row)+['zone_name'=>$row['zone_name'],'review_version'=>branchReviewVersion($row)];
}
