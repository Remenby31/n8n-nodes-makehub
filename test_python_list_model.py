import requests
import json

def get_makehub_models(api_key):
    """
    Récupère la liste des modèles disponibles depuis l'API MakeHub.
    
    Args:
        api_key (str): Clé API MakeHub pour l'authentification
        
    Returns:
        list: Liste des modèles disponibles
    """
    # Configuration de la requête
    url = "https://api.makehub.ai/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        # Envoi de la requête
        response = requests.get(url, headers=headers)
        
        # Vérification du statut de la réponse
        response.raise_for_status()
        
        # Récupération des données JSON
        data = response.json()
        
        # Affichage de la structure complète pour débogage
        print("Structure de la réponse complète:")
        print(json.dumps(data, indent=2))
        
        # Déterminer où se trouve le tableau de modèles
        models = []
        if isinstance(data, list):
            models = data
        elif isinstance(data, dict):
            # Chercher un tableau dans les propriétés de premier niveau
            for key in data:
                if isinstance(data[key], list):
                    models = data[key]
                    print(f"Tableau trouvé dans la propriété '{key}'")
                    break
        
        # Extraction des IDs de modèles
        model_ids = []
        if models:
            # Analyse du premier modèle pour déterminer la structure
            first_model = models[0]
            print("Structure du premier modèle:")
            print(json.dumps(first_model, indent=2))
            
            # Recherche de la propriété contenant l'ID
            id_property = None
            for prop in ['model_id', 'id', 'name', 'value', 'key']:
                if prop in first_model:
                    id_property = prop
                    print(f"Utilisation de la propriété '{id_property}' comme identifiant")
                    break
            
            # Extraction des IDs si la propriété a été trouvée
            if id_property:
                model_ids = [model[id_property] for model in models if id_property in model]
            
        return model_ids
    
    except requests.exceptions.RequestException as e:
        print(f"Erreur lors de la requête API: {e}")
        if hasattr(e.response, 'text'):
            print(f"Réponse du serveur: {e.response.text}")
        return []

# Exemple d'utilisation
if __name__ == "__main__":
    # Remplacez par votre clé API MakeHub
    API_KEY = "sk_j-iEDyn0aRHmmRkEOz-iSzO4l9IjIqoJzp8hse1M250"
    
    models = get_makehub_models(API_KEY)
    
    print("\nListe des modèles disponibles:")
    for i, model in enumerate(models, 1):
        print(f"{i}. {model}")
    
    if not models:
        print("Aucun modèle n'a été récupéré.")