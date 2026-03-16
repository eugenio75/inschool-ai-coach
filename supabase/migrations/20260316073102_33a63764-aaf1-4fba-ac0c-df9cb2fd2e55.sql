-- Reset Armando's gamification (child_profile_id: 43787228...) back to 0
UPDATE gamification 
SET focus_points = 0, autonomy_points = 0, consistency_points = 0, streak = 0, last_activity_date = NULL, updated_at = now()
WHERE child_profile_id = '43787228-ac27-4474-9578-55c471f26609';

-- Reset completed missions for today
UPDATE daily_missions 
SET completed = false, completed_at = NULL
WHERE child_profile_id = '43787228-ac27-4474-9578-55c471f26609' 
AND mission_date = CURRENT_DATE;