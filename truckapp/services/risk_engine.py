import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class RiskEngine:
    # Risk thresholds from spec
    RISK_THRESHOLDS = {
        'wind': {'low': 25, 'moderate': 34, 'high': 44, 'severe': 54, 'no_travel': 55},
        'rain': {'low': 0.10, 'moderate': 0.25, 'high': 0.50, 'severe': 1.00, 'no_travel': 1.01},
        'snow': {'low': 0.5, 'moderate': 1.0, 'high': 2.0, 'severe': 3.0, 'no_travel': 3.1}
    }
    
    def assess_risk(self, weather: Dict, load_weight: int = None) -> str:
        """Assess risk level for a single checkpoint based on weather and load"""
        logger.debug(f"[RISK_ENGINE] Assessing risk - Wind: {weather.get('wind_speed')} mph, Precip: {weather.get('precipitation')} mm, Temp: {weather.get('temperature')}°F, Load: {load_weight} lbs")
        wind_speed = weather.get('wind_speed', 0)
        precipitation = weather.get('precipitation', 0)
        
        # Determine precipitation type (simplified - assuming rain unless temp < 32)
        temp = weather.get('temperature', 70)
        precip_type = 'snow' if temp < 32 else 'rain'
        logger.debug(f"[RISK_ENGINE] Precipitation type: {precip_type} (based on temp {temp}°F)")
        
        # Check wind risk
        wind_risk = self._get_condition_risk('wind', wind_speed)
        logger.debug(f"[RISK_ENGINE] Wind risk: {wind_risk}")
        
        # Check precipitation risk
        precip_risk = self._get_condition_risk(precip_type, precipitation)
        logger.debug(f"[RISK_ENGINE] Precipitation risk: {precip_risk}")
        
        # Apply load rules
        adjusted_risk = self._apply_load_rules(wind_risk, wind_speed, load_weight)
        logger.debug(f"[RISK_ENGINE] Load-adjusted risk: {adjusted_risk}")
        
        # Take the highest risk level
        risk_levels = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']
        wind_idx = risk_levels.index(wind_risk) if wind_risk in risk_levels else 0
        precip_idx = risk_levels.index(precip_risk) if precip_risk in risk_levels else 0
        adjusted_idx = risk_levels.index(adjusted_risk) if adjusted_risk in risk_levels else 0
        
        final_risk = risk_levels[max(wind_idx, precip_idx, adjusted_idx)]
        logger.info(f"[RISK_ENGINE] Final risk level: {final_risk}")
        return final_risk
    
    def _get_condition_risk(self, condition_type: str, value: float) -> str:
        """Get risk level for a specific condition"""
        thresholds = self.RISK_THRESHOLDS[condition_type]
        
        if value >= thresholds['no_travel']:
            return 'No Travel'
        elif value >= thresholds['severe']:
            return 'Severe'
        elif value >= thresholds['high']:
            return 'High'
        elif value >= thresholds['moderate']:
            return 'Moderate'
        else:
            return 'Low'
    
    def _apply_load_rules(self, current_risk: str, wind_speed: float, load_weight: int = None) -> str:
        """Apply load-specific risk rules from spec"""
        if load_weight is None:
            return current_risk
        
        # Rule: ≥55 mph → No Travel for any load
        if wind_speed >= 55:
            return 'No Travel'
        
        # Rule: 45–54 mph + >30,000 lb → No Travel
        if 45 <= wind_speed <= 54 and load_weight > 30000:
            return 'No Travel'
        
        # Rule: 35–44 mph + >40,000 lb → Severe
        if 35 <= wind_speed <= 44 and load_weight > 40000:
            return 'Severe'
        
        return current_risk
    
    def calculate_route_risk_summary(self, checkpoints: List[Dict], load_weight: int = None) -> Dict:
        """Calculate overall risk summary for a route"""
        logger.debug(f"[RISK_ENGINE] Calculating route risk summary for {len(checkpoints)} checkpoints")
        risk_counts = {'Low': 0, 'Moderate': 0, 'High': 0, 'Severe': 0, 'No Travel': 0}
        
        for checkpoint in checkpoints:
            risk_level = checkpoint.get('risk_level', 'Low')
            risk_counts[risk_level] = risk_counts.get(risk_level, 0) + 1
        logger.debug(f"[RISK_ENGINE] Risk counts: {risk_counts}")
        
        total_checkpoints = len(checkpoints)
        
        # Calculate average risk score
        risk_scores = {'Low': 1, 'Moderate': 2, 'High': 3, 'Severe': 4, 'No Travel': 5}
        total_score = sum(risk_counts[risk] * risk_scores[risk] for risk in risk_counts)
        average_risk = total_score / total_checkpoints if total_checkpoints > 0 else 1
        
        # Determine overall risk level
        if risk_counts['No Travel'] > 0:
            overall_risk = 'No Travel'
        elif risk_counts['Severe'] > 0:
            overall_risk = 'Severe'
        elif average_risk >= 2.5:
            overall_risk = 'High'
        elif average_risk >= 1.5:
            overall_risk = 'Moderate'
        else:
            overall_risk = 'Low'
        logger.debug(f"[RISK_ENGINE] Overall risk level: {overall_risk}")
        
        # Load risk assessment
        load_risk = 'Low'
        if load_weight:
            if load_weight > 50000:
                load_risk = 'High'
            elif load_weight > 30000:
                load_risk = 'Moderate'
        logger.debug(f"[RISK_ENGINE] Load risk: {load_risk}")
        
        logger.info(f"[RISK_ENGINE] Route risk summary - Weather: {overall_risk}, Load: {load_risk}, Overall: {overall_risk}, Avg Score: {average_risk:.2f}")
        return {
            'weather_risk': overall_risk,
            'load_risk': load_risk,
            'overall_risk': overall_risk,
            'risk_counts': risk_counts,
            'average_risk_score': average_risk
        }
